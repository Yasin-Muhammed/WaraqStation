import { Buffer } from 'node:buffer';
import { createWorker, PSM, OEM } from 'tesseract.js';
import sharp from 'sharp';
import { postprocessArabicOCR, containsArabic } from './arabic-text-processor';

/**
 * Advanced Arabic OCR with multiple strategies and preprocessing techniques
 */

export interface ArabicOCRResult {
  text: string;
  confidence: number;
  strategy: string;
  preprocessingTime: number;
  ocrTime: number;
}

export interface ArabicOCROptions {
  languages: string[];
  maxAttempts?: number;
  minConfidenceThreshold?: number;
  enableAdvancedPreprocessing?: boolean;
}

/**
 * Multiple preprocessing strategies for Arabic OCR
 */
const PREPROCESSING_STRATEGIES = [
  {
    name: 'high_contrast_binarized',
    options: {
      targetDpi: 400,
      enhanceContrast: true,
      sharpen: true,
      binarizationThreshold: 128,
      grayscale: true,
      reduceNoise: false,
    },
  },
  {
    name: 'adaptive_threshold',
    options: {
      targetDpi: 350,
      enhanceContrast: true,
      sharpen: true,
      binarizationThreshold: undefined, // Auto threshold
      grayscale: true,
      reduceNoise: true,
    },
  },
  {
    name: 'noise_reduced_enhanced',
    options: {
      targetDpi: 300,
      enhanceContrast: true,
      sharpen: false,
      binarizationThreshold: 140,
      grayscale: true,
      reduceNoise: true,
    },
  },
  {
    name: 'minimal_processing',
    options: {
      targetDpi: 250,
      enhanceContrast: false,
      sharpen: false,
      binarizationThreshold: undefined,
      grayscale: true,
      reduceNoise: false,
    },
  },
];

/**
 * Advanced image preprocessing specifically for Arabic text
 */
async function advancedArabicPreprocessing(
  buffer: Buffer,
  strategyName: string
): Promise<Buffer> {
  const strategy = PREPROCESSING_STRATEGIES.find(s => s.name === strategyName);
  if (!strategy) {
    throw new Error(`Unknown preprocessing strategy: ${strategyName}`);
  }
  
  const { options } = strategy;
  let image = sharp(buffer);
  
  // Get metadata
  const metadata = await image.metadata();
  const width = metadata.width || 0;
  const height = metadata.height || 0;
  
  // Skip if too small
  if (width < 20 || height < 20) {
    return buffer;
  }
  
  // Intelligent scaling for Arabic text
  const currentDpi = metadata.density || 72;
  let scaleFactor = options.targetDpi / currentDpi;
  
  // Ensure minimum dimensions for Arabic text readability
  const minWidth = 600;  // Higher for Arabic
  const minHeight = 300;
  
  if (width < minWidth || height < minHeight) {
    const scaleX = minWidth / width;
    const scaleY = minHeight / height;
    scaleFactor = Math.max(scaleFactor, Math.min(scaleX, scaleY), 2.0); // At least 2x for small Arabic text
  }
  
  // Limit maximum scaling to avoid artifacts
  scaleFactor = Math.min(scaleFactor, 5.0);
  
  if (scaleFactor > 1.1 || scaleFactor < 0.9) {
    const newWidth = Math.round(width * scaleFactor);
    const newHeight = Math.round(height * scaleFactor);
    
    image = image.resize(newWidth, newHeight, {
      kernel: sharp.kernel.lanczos3,
      withoutEnlargement: false,
    });
  }
  
  // Convert to grayscale
  if (options.grayscale) {
    image = image.grayscale();
  }
  
  // Noise reduction before enhancement
  if (options.reduceNoise) {
    // Apply bilateral filter effect using blur and sharpen combination
    image = image.blur(0.8).sharpen({ sigma: 0.8, m1: 0.8, m2: 1.5 });
  }
  
  // Contrast enhancement
  if (options.enhanceContrast) {
    // Multi-stage contrast enhancement
    image = image.normalize(); // Global normalization
    image = image.gamma(1.1);  // Gamma correction
    image = image.linear(1.3, -30); // Linear adjustment
  }
  
  // Text sharpening
  if (options.sharpen) {
    image = image.sharpen({
      sigma: 2.0,     // Larger radius for Arabic text
      m1: 1.0,
      m2: 3.0,        // Stronger sharpening
      x1: 4.0,
      y2: 20.0,
      y3: 30.0,
    });
  }
  
  // Morphological operations for text cleanup
  // Erosion followed by dilation (opening) to remove noise
  const kernel = Buffer.from([
    0, 1, 0,
    1, 1, 1,
    0, 1, 0
  ]);
  
  // Apply morphological opening to clean up text
  image = image.convolve({
    width: 3,
    height: 3,
    kernel: [0, 1, 0, 1, 1, 1, 0, 1, 0]
  });
  
  // Binarization
  if (options.binarizationThreshold !== undefined) {
    image = image.threshold(options.binarizationThreshold);
  } else {
    // Advanced adaptive thresholding
    const stats = await image.clone().stats();
    const channel = stats.channels[0]; // Grayscale
    const mean = channel.mean;
    const std = channel.stdev;
    
    // Calculate threshold based on image statistics
    const threshold = Math.max(80, Math.min(200, mean - (std * 0.3)));
    image = image.threshold(Math.round(threshold));
  }
  
  // Final enhancement pass
  image = image.linear(1.1, 0); // Slight contrast boost
  
  return image.png({ quality: 100, compressionLevel: 0 }).toBuffer();
}

/**
 * Advanced Arabic OCR with multiple attempts and strategies
 */
export async function performAdvancedArabicOCR(
  imageBuffer: Buffer | ArrayBuffer,
  options: ArabicOCROptions
): Promise<ArabicOCRResult> {
  const {
    languages,
    maxAttempts = 3,
    minConfidenceThreshold = 75,
    enableAdvancedPreprocessing = true,
  } = options;
  
  const buffer = imageBuffer instanceof ArrayBuffer ? Buffer.from(imageBuffer) : imageBuffer;
  const isArabicOCR = languages.includes('ara');
  
  let bestResult: ArabicOCRResult = {
    text: '',
    confidence: 0,
    strategy: 'none',
    preprocessingTime: 0,
    ocrTime: 0,
  };
  
  // Strategy 1: Try with advanced preprocessing
  if (enableAdvancedPreprocessing && isArabicOCR) {
    for (let i = 0; i < Math.min(maxAttempts, PREPROCESSING_STRATEGIES.length); i++) {
      const strategy = PREPROCESSING_STRATEGIES[i]!;
      
      try {
        console.log(`Attempting Arabic OCR with strategy: ${strategy.name}`);
        
        const preprocessingStart = Date.now();
        const preprocessedBuffer = await advancedArabicPreprocessing(buffer, strategy.name);
        const preprocessingTime = Date.now() - preprocessingStart;
        
        const ocrStart = Date.now();
        const result = await performSingleOCRAttempt(preprocessedBuffer, languages, strategy.name, undefined, OEM.LSTM_ONLY);
        const ocrTime = Date.now() - ocrStart;
        
        const ocrResult: ArabicOCRResult = {
          ...result,
          strategy: strategy.name,
          preprocessingTime,
          ocrTime,
        };
        
        console.log(`Strategy ${strategy.name}: ${result.confidence}% confidence`);
        
        if (result.confidence > bestResult.confidence) {
          bestResult = ocrResult;
        }
        
        // If we achieve good confidence, stop trying
        if (result.confidence >= minConfidenceThreshold) {
          console.log(`Good confidence achieved with strategy: ${strategy.name}`);
          break;
        }
      } catch (error) {
        console.warn(`Strategy ${strategy.name} failed:`, error instanceof Error ? error.message : String(error));
        // Continue with next strategy instead of failing completely
        continue;
      }
    }
  }
  
  // Strategy 2: Try with original image if no good result yet
  if (bestResult.confidence < minConfidenceThreshold) {
    try {
      console.log('Trying OCR with original image...');
      const ocrStart = Date.now();
      const result = await performSingleOCRAttempt(buffer, languages, 'original', undefined, OEM.LSTM_ONLY);
      const ocrTime = Date.now() - ocrStart;
      
      const ocrResult: ArabicOCRResult = {
        ...result,
        strategy: 'original',
        preprocessingTime: 0,
        ocrTime,
      };
      
      if (result.confidence > bestResult.confidence) {
        bestResult = ocrResult;
      }
          } catch (error) {
        console.warn('Original image OCR failed:', error instanceof Error ? error.message : String(error));
      }
  }
  
  // Strategy 3: Try with different PSM modes if still not good
  if (bestResult.confidence < minConfidenceThreshold && isArabicOCR) {
    const psmModes = [PSM.AUTO, PSM.SINGLE_BLOCK, PSM.SINGLE_COLUMN, PSM.SPARSE_TEXT];
    
    for (const psm of psmModes) {
      try {
        console.log(`Trying OCR with PSM mode: ${psm}`);
        const ocrStart = Date.now();
        const result = await performSingleOCRAttempt(buffer, languages, `psm_${psm}`, psm, OEM.LSTM_ONLY);
        const ocrTime = Date.now() - ocrStart;
        
        const ocrResult: ArabicOCRResult = {
          ...result,
          strategy: `psm_${psm}`,
          preprocessingTime: 0,
          ocrTime,
        };
        
        if (result.confidence > bestResult.confidence) {
          bestResult = ocrResult;
        }
        
        if (result.confidence >= minConfidenceThreshold) {
          break;
        }
              } catch (error) {
        console.warn(`PSM mode ${psm} failed:`, error instanceof Error ? error.message : String(error));
      }
    }
  }
  
  console.log(`Best Arabic OCR result: ${bestResult.confidence}% confidence using strategy: ${bestResult.strategy}`);
  
  return bestResult;
}

/**
 * Performs a single OCR attempt with specific parameters
 */
async function performSingleOCRAttempt(
  buffer: Buffer,
  languages: string[],
  strategyName: string,
  psmMode?: PSM,
  oemMode?: OEM
): Promise<{ text: string; confidence: number }> {
  let worker;
  
  try {
    // Create worker with specific OEM mode if provided
    worker = oemMode !== undefined 
      ? await createWorker(languages, oemMode)
      : await createWorker(languages);
  } catch (error) {
    console.warn(`Failed to create worker for ${strategyName}:`, error instanceof Error ? error.message : String(error));
    throw new Error(`Worker creation failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  
  try {
    const isArabicOCR = languages.includes('ara');
    
    // Set optimal parameters for Arabic OCR (excluding tessedit_ocr_engine_mode)
    await worker.setParameters({
      preserve_interword_spaces: '1',
      tessedit_pageseg_mode: psmMode || PSM.AUTO,
      
      // Arabic-specific optimizations
      ...(isArabicOCR && {
        // Character recognition improvements
        classify_enable_learning: '1',
        classify_enable_adaptive_matcher: '1',
        
        // Text layout improvements
        textord_heavy_nr: '1',
        textord_debug_tabfind: '0',
        textord_really_old_xheight: '0',
        textord_tabfind_show_vlines: '0',
        textord_tabfind_force_vertical_text: '0',
        textord_min_linesize: '1.0',
        
        // Word recognition improvements
        textord_noise_area_ratio: '0.7',
        textord_noise_cert_basechar: '-8.0',
        textord_noise_cert_disjoint: '-10.0',
        textord_noise_cert_punc: '-5.0',
        textord_noise_cert_factor: '0.5',
        
        // Language model improvements
        language_model_penalty_non_freq_dict_word: '0.1',
        language_model_penalty_non_dict_word: '0.15',
        
        // Segmentation improvements for Arabic
        wordrec_enable_assoc: '1',
        segment_penalty_dict_nonword: '1.25',
        segment_penalty_garbage: '1.50',
        
        // Character whitelist for Arabic (remove if causing issues)
        tessedit_char_whitelist: '',
        tessedit_char_blacklist: '',
      }),
    });
    
    const { data: { text, confidence } } = await worker.recognize(buffer);
    
    // Post-process Arabic text
    let processedText = text;
    if (isArabicOCR && text && containsArabic(text)) {
      try {
        processedText = postprocessArabicOCR(text);
      } catch (error) {
        console.warn('Arabic post-processing failed:', error.message);
        processedText = text;
      }
    }
    
    return {
      text: processedText,
      confidence: confidence || 0,
    };
  } finally {
    try {
      if (worker) {
        await worker.terminate();
      }
    } catch (error) {
      console.warn(`Failed to terminate worker for ${strategyName}:`, error instanceof Error ? error.message : String(error));
    }
  }
}

// containsArabic is imported from arabic-text-processor

/**
 * Creates multiple versions of the image with different enhancements
 */
export async function createImageVariants(buffer: Buffer): Promise<Array<{ buffer: Buffer; name: string }>> {
  const variants: Array<{ buffer: Buffer; name: string }> = [];
  
  try {
    const image = sharp(buffer);
    const metadata = await image.metadata();
    
    // Original
    variants.push({ buffer, name: 'original' });
    
    // High contrast version
    try {
      const highContrast = await image.clone()
        .normalize()
        .gamma(1.2)  // Fixed: gamma must be >= 1.0
        .linear(1.5, -50)
        .threshold(120)
        .png({ quality: 100 })
        .toBuffer();
      variants.push({ buffer: highContrast, name: 'high_contrast' });
    } catch (error) {
      console.warn('High contrast variant failed:', error.message);
    }
    
    // Denoised version
    try {
      // Check if image is large enough for denoising operations
      if ((metadata.width || 0) >= 10 && (metadata.height || 0) >= 10) {
        const denoised = await image.clone()
          .median(2)
          .normalize()
          .sharpen({ sigma: 1.5, m1: 1.0, m2: 2.0 })
          .threshold(130)
          .png({ quality: 100 })
          .toBuffer();
        variants.push({ buffer: denoised, name: 'denoised' });
      } else {
        console.warn('Image too small for denoising, skipping denoised variant');
      }
    } catch (error) {
      console.warn('Denoised variant failed:', error.message);
    }
    
    // Enhanced for small text
    try {
      const currentWidth = metadata.width || 0;
      const currentHeight = metadata.height || 0;
      
      // Only upscale if the image is reasonably sized
      if (currentWidth >= 5 && currentHeight >= 5) {
        const enhanced = await image.clone()
          .resize(
            Math.max(800, currentWidth * 2),
            Math.max(600, currentHeight * 2),
            { kernel: sharp.kernel.lanczos3 }
          )
          .grayscale()
          .normalize()
          .sharpen({ sigma: 2.0, m1: 1.0, m2: 3.0 })
          .threshold(125)
          .png({ quality: 100 })
          .toBuffer();
        variants.push({ buffer: enhanced, name: 'enhanced_upscaled' });
      } else {
        console.warn('Image too small for upscaling, skipping enhanced variant');
      }
    } catch (error) {
      console.warn('Enhanced variant failed:', error.message);
    }
    
    return variants;
  } catch (error) {
    console.warn('Image variant creation failed:', error.message);
    return [{ buffer, name: 'original' }];
  }
}

/**
 * Performs OCR with multiple image variants and returns the best result
 */
export async function performMultiVariantArabicOCR(
  imageBuffer: Buffer | ArrayBuffer,
  options: ArabicOCROptions
): Promise<ArabicOCRResult> {
  const buffer = imageBuffer instanceof ArrayBuffer ? Buffer.from(imageBuffer) : imageBuffer;
  const { languages, minConfidenceThreshold = 70 } = options;
  
  console.log('Starting multi-variant Arabic OCR...');
  
  // Create multiple image variants
  const variants = await createImageVariants(buffer);
  
  let bestResult: ArabicOCRResult = {
    text: '',
    confidence: 0,
    strategy: 'none',
    preprocessingTime: 0,
    ocrTime: 0,
  };
  
  // Try each variant
  for (const variant of variants) {
    try {
      console.log(`Trying OCR with variant: ${variant.name}`);
      
      const ocrStart = Date.now();
      const result = await performSingleOCRAttempt(variant.buffer, languages, variant.name, undefined, OEM.LSTM_ONLY);
      const ocrTime = Date.now() - ocrStart;
      
      const ocrResult: ArabicOCRResult = {
        ...result,
        strategy: variant.name,
        preprocessingTime: 0, // Included in variant creation
        ocrTime,
      };
      
      console.log(`Variant ${variant.name}: ${result.confidence}% confidence`);
      
      if (result.confidence > bestResult.confidence) {
        bestResult = ocrResult;
      }
      
      // Stop if we achieve good confidence
      if (result.confidence >= minConfidenceThreshold) {
        console.log(`Good confidence achieved with variant: ${variant.name}`);
        break;
      }
    } catch (error) {
      console.warn(`Variant ${variant.name} failed:`, error.message);
    }
  }
  
  return bestResult;
}