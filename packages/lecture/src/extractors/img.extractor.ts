import { Buffer } from 'node:buffer';
import { createWorker, PSM, OEM } from 'tesseract.js';
import sharp from 'sharp';
import { defineTextExtractor } from '../extractors.models';

interface OCROptions {
  languages: string[];
  isArabic?: boolean;
}

interface OCRResult {
  text: string;
  confidence: number;
}

// Validate and clamp gamma values
function validateGamma(gamma: number): number {
  // Allow gamma values from 0.1 to 3.0, clamp invalid values
  if (gamma < 0.1) return 0.1;
  if (gamma > 3.0) return 3.0;
  return gamma;
}

// Enhanced image preprocessing for better OCR results
async function preprocessImage(buffer: Buffer, variant: 'original' | 'denoised' | 'enhanced_upscaled' | 'high_contrast' = 'original'): Promise<Buffer> {
  try {
    let image = sharp(buffer);
    const metadata = await image.metadata();
    
    // Ensure minimum image dimensions
    const minWidth = 100;
    const minHeight = 50;
    
    if (!metadata.width || !metadata.height) {
      throw new Error('Unable to determine image dimensions');
    }
    
    // Scale up small images to prevent "Image too small" errors
    if (metadata.width < minWidth || metadata.height < minHeight) {
      const scaleX = Math.max(1, Math.ceil(minWidth / metadata.width));
      const scaleY = Math.max(1, Math.ceil(minHeight / metadata.height));
      const scale = Math.max(scaleX, scaleY);
      
      image = image.resize(metadata.width * scale, metadata.height * scale, {
        kernel: sharp.kernel.nearest
      });
    }
    
    switch (variant) {
      case 'high_contrast':
        image = image
          .gamma(validateGamma(1.2)) // Use validated gamma
          .normalize()
          .modulate({ brightness: 1.1 })
          .linear(1.5, 0); // Use linear for contrast adjustment
        break;
        
      case 'denoised':
        image = image
          .blur(0.5)
          .sharpen(1, 1, 0.5)
          .normalize();
        break;
        
      case 'enhanced_upscaled':
        // Scale up by 2x for better OCR on small text
        if (metadata.width && metadata.height) {
          image = image
            .resize(metadata.width * 2, metadata.height * 2, {
              kernel: sharp.kernel.lanczos3
            })
            .gamma(validateGamma(1.1))
            .modulate({ brightness: 1.05 })
            .linear(1.3, 0) // Use linear for contrast adjustment
            .sharpen(0.5, 1, 0.5);
        }
        break;
        
      case 'original':
      default:
        // Minimal processing for original
        image = image.normalize();
        break;
    }
    
    // Convert to grayscale and ensure proper format
    return await image
      .greyscale()
      .png()
      .toBuffer();
      
  } catch (error) {
    console.warn(`Image preprocessing failed for variant ${variant}:`, error.message);
    // Return original buffer if preprocessing fails
    return buffer;
  }
}

// Create worker with proper initialization parameters
async function createOCRWorker(languages: string[]): Promise<any> {
  try {
    // Only use languages that are commonly available offline
    const availableLanguages = languages.filter(lang => 
      ['ara', 'eng'].includes(lang)
    );
    
    if (availableLanguages.length === 0) {
      availableLanguages.push('eng'); // Fallback to English
    }
    
    const worker = await createWorker(availableLanguages, OEM.LSTM_ONLY);
    
    return worker;
  } catch (error) {
    console.warn('Failed to create worker with specified languages, falling back to English:', error.message);
    // Fallback to English only
    return await createWorker(['eng'], OEM.LSTM_ONLY);
  }
}

// Calculate text quality score based on Arabic characteristics
function calculateArabicQuality(text: string): number {
  if (!text || text.trim().length === 0) return 0;
  
  // Arabic Unicode range: \u0600-\u06FF
  const arabicChars = text.match(/[\u0600-\u06FF]/g);
  const totalChars = text.replace(/\s/g, '').length;
  
  if (totalChars === 0) return 0;
  
  const arabicRatio = arabicChars ? arabicChars.length / totalChars : 0;
  
  // Consider it high quality Arabic if >50% of characters are Arabic
  return arabicRatio > 0.5 ? 100 : arabicRatio * 100;
}

// Advanced multi-variant OCR processing
async function performAdvancedOCR(buffer: Buffer, options: OCROptions): Promise<OCRResult> {
  const variants: Array<'original' | 'denoised' | 'enhanced_upscaled' | 'high_contrast'> = [
    'original', 'denoised', 'enhanced_upscaled', 'high_contrast'
  ];
  
  let bestResult: OCRResult = { text: '', confidence: 0 };
  
  console.log('Starting multi-variant Arabic OCR...');
  
  for (const variant of variants) {
    try {
      console.log(`Trying OCR with variant: ${variant}`);
      
      const processedBuffer = await preprocessImage(buffer, variant);
      const worker = await createOCRWorker(options.languages);
      
      const { data } = await worker.recognize(processedBuffer);
      await worker.terminate();
      
      const confidence = data.confidence || 0;
      const text = data.text || '';
      
      if (options.isArabic) {
        const arabicQuality = calculateArabicQuality(text);
        console.log(`Arabic text quality score: ${arabicQuality}%`);
      }
      
      console.log(`Variant ${variant}: ${confidence}% confidence`);
      
      if (confidence > bestResult.confidence) {
        bestResult = { text, confidence };
      }
      
      // If we get good confidence, we can stop early
      if (confidence > 85) {
        break;
      }
      
    } catch (error) {
      console.warn(`${variant} variant failed:`, error.message);
      continue;
    }
  }
  
  return bestResult;
}

// Comprehensive fallback OCR with different language combinations
async function performFallbackOCR(buffer: Buffer, options: OCROptions): Promise<OCRResult> {
  console.log('Starting comprehensive Arabic OCR fallback...');
  
  // Try different language combinations, avoiding network-dependent languages
  const languageCombinations = [
    ['ara'],
    ['ara', 'eng'],
    ['eng'], // Final fallback
  ];
  
  let bestResult: OCRResult = { text: '', confidence: 0 };
  
  for (const languages of languageCombinations) {
    try {
      console.log(`Trying OCR with languages: ${languages.join(', ')}`);
      
      const worker = await createOCRWorker(languages);
      const { data } = await worker.recognize(buffer);
      await worker.terminate();
      
      const confidence = data.confidence || 0;
      const text = data.text || '';
      
      if (options.isArabic) {
        const arabicQuality = calculateArabicQuality(text);
        console.log(`Arabic text quality score: ${arabicQuality}%`);
      }
      
      console.log(`Languages ${languages.join(', ')}: ${confidence}% confidence`);
      
      if (confidence > bestResult.confidence) {
        bestResult = { text, confidence };
      }
      
      // If we get reasonable confidence, use it
      if (confidence > 60) {
        break;
      }
      
    } catch (error) {
      console.warn(`Language combination ${languages.join(', ')} failed:`, error.message);
      continue;
    }
  }
  
  return bestResult;
}

export async function extractTextFromImage(maybeArrayBuffer: ArrayBuffer | Buffer, { languages }: { languages: string[] }): Promise<string> {
  const buffer = maybeArrayBuffer instanceof ArrayBuffer ? Buffer.from(maybeArrayBuffer) : maybeArrayBuffer;
  
  // Check if Arabic is one of the target languages
  const isArabic = languages.some(lang => lang === 'ara' || lang === 'ar');
  
  try {
    if (isArabic) {
      console.log('Using advanced Arabic OCR processing...');
      
      // Try advanced processing first
      const advancedResult = await performAdvancedOCR(buffer, { languages, isArabic });
      
      if (advancedResult.confidence >= 70) {
        return advancedResult.text;
      }
      
      console.log(`Advanced OCR confidence too low: ${advancedResult.confidence}%, trying comprehensive fallback...`);
      
      // Try fallback approach
      const fallbackResult = await performFallbackOCR(buffer, { languages, isArabic });
      
      // Return the better result
      if (fallbackResult.confidence > advancedResult.confidence) {
        return fallbackResult.text;
      } else {
        return advancedResult.text;
      }
    } else {
      // Standard OCR for non-Arabic text
      const worker = await createOCRWorker(languages);
      const { data: { text } } = await worker.recognize(buffer);
      await worker.terminate();
      return text;
    }
  } catch (error) {
    console.error('OCR processing failed:', error.message);
    
    // Final fallback: simple English OCR
    try {
      const worker = await createOCRWorker(['eng']);
      const { data: { text } } = await worker.recognize(buffer);
      await worker.terminate();
      return text;
    } catch (finalError) {
      console.error('Final fallback OCR failed:', finalError.message);
      return '';
    }
  }
}

export const imageExtractorDefinition = defineTextExtractor({
  name: 'image',
  mimeTypes: [
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
  ],
  extract: async ({ arrayBuffer, config }) => {
    const { languages } = config.tesseract;

    const content = await extractTextFromImage(arrayBuffer, { languages });

    return { content };
  },
});
