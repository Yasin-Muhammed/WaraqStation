import { Buffer } from 'node:buffer';
import { createWorker, PSM } from 'tesseract.js';
import { defineTextExtractor } from '../extractors.models';
import { containsArabic, postprocessArabicOCR } from '../utils/arabic-text-processor';
import { validateImageForOCR } from '../utils/image-preprocessor';
import { performMultiVariantArabicOCR } from '../utils/advanced-arabic-ocr';
import { performComprehensiveArabicOCR } from '../utils/arabic-ocr-fallback';

export async function extractTextFromImage(maybeArrayBuffer: ArrayBuffer | Buffer, { languages }: { languages: string[] }) {
  const buffer = maybeArrayBuffer instanceof ArrayBuffer ? Buffer.from(maybeArrayBuffer) : maybeArrayBuffer;
  
  // Check if Arabic is in the language list
  const isArabicOCR = languages.includes('ara');
  
  // Use advanced Arabic OCR if Arabic language is detected
  if (isArabicOCR) {
    console.log('Using advanced Arabic OCR processing...');
    
    try {
      // Validate image quality first
      const validation = await validateImageForOCR(buffer);
      if (!validation.isValid) {
        console.warn('Image quality issues detected:', validation.issues);
        console.info('Recommendations:', validation.recommendations);
      }
      
      // Step 1: Try advanced multi-variant approach
      const advancedResult = await performMultiVariantArabicOCR(buffer, {
        languages,
        maxAttempts: 3,
        minConfidenceThreshold: 75,
        enableAdvancedPreprocessing: true,
      });
      
      if (advancedResult.confidence >= 75) {
        console.log(`Advanced Arabic OCR succeeded: ${advancedResult.confidence}% confidence using ${advancedResult.strategy}`);
        return advancedResult.text;
      }
      
      console.log(`Advanced OCR confidence too low: ${advancedResult.confidence}%, trying comprehensive fallback...`);
      
      // Step 2: Try comprehensive fallback with different approaches
      const fallbackResult = await performComprehensiveArabicOCR(buffer, languages);
      
      if (fallbackResult.success && fallbackResult.confidence > advancedResult.confidence) {
        console.log(`Fallback OCR succeeded: ${fallbackResult.confidence}% confidence using ${fallbackResult.method}`);
        return fallbackResult.text;
      }
      
      // Use the better of the two results
      if (advancedResult.confidence > 0) {
        console.log(`Using advanced OCR result: ${advancedResult.confidence}% confidence`);
        return advancedResult.text;
      } else if (fallbackResult.success) {
        console.log(`Using fallback OCR result: ${fallbackResult.confidence}% confidence`);
        return fallbackResult.text;
      } else {
        console.warn('All Arabic OCR approaches failed, falling back to standard OCR');
      }
    } catch (error) {
      console.warn('Advanced Arabic OCR failed:', error instanceof Error ? error.message : String(error));
      console.log('Falling back to standard OCR...');
    }
  }
  
  // Fallback to standard OCR for non-Arabic or when advanced OCR fails
  return performStandardOCR(buffer, languages);
}

/**
 * Standard OCR processing (fallback)
 */
async function performStandardOCR(buffer: Buffer, languages: string[]): Promise<string> {
  const worker = await createWorker(languages);
  
  try {
    const isArabicOCR = languages.includes('ara');
    
    // Set basic Arabic-optimized parameters
    if (isArabicOCR) {
      await worker.setParameters({
        preserve_interword_spaces: '1',
        tessedit_pageseg_mode: PSM.AUTO,
        classify_enable_adaptive_matcher: '1',
        textord_heavy_nr: '1',
      });
    }

    const { data: { text, confidence } } = await worker.recognize(buffer);
    
    // Post-process Arabic text if detected
    let processedText = text;
    if (isArabicOCR && containsArabic(text)) {
      try {
        processedText = postprocessArabicOCR(text);
      } catch (error) {
        console.warn('Arabic text post-processing failed:', error.message);
        processedText = text;
      }
    }
    
    // Log confidence for debugging
    console.log(`Standard OCR confidence: ${confidence}% for languages: ${languages.join(', ')}`);
    
    if (confidence < 70 && isArabicOCR) {
      console.info('For better Arabic OCR results, try:');
      console.info('- Higher resolution images (300+ DPI)');
      console.info('- Better contrast and lighting');
      console.info('- Cleaner text without noise or artifacts');
    }

    return processedText;
  } finally {
    await worker.terminate();
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
