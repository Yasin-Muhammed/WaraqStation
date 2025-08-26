import { Buffer } from 'node:buffer';
import { createWorker, PSM } from 'tesseract.js';
import { defineTextExtractor } from '../extractors.models';
import { containsArabic, postprocessArabicOCR } from '../utils/arabic-text-processor';
import { preprocessArabicDocument, validateImageForOCR } from '../utils/image-preprocessor';

export async function extractTextFromImage(maybeArrayBuffer: ArrayBuffer | Buffer, { languages }: { languages: string[] }) {
  const buffer = maybeArrayBuffer instanceof ArrayBuffer ? Buffer.from(maybeArrayBuffer) : maybeArrayBuffer;
  
  // Check if Arabic is in the language list
  const isArabicOCR = languages.includes('ara');
  
  let processedBuffer = buffer;
  
  // Apply Arabic-specific preprocessing if Arabic language is detected
  if (isArabicOCR) {
    try {
      // Validate image quality
      const validation = await validateImageForOCR(buffer);
      if (!validation.isValid) {
        console.warn('Image quality issues detected:', validation.issues);
        console.info('Recommendations:', validation.recommendations);
      }
      
      // Preprocess image for optimal Arabic OCR with safer settings
      processedBuffer = await preprocessArabicDocument(buffer, {
        enhanceContrast: true,
        reduceNoise: false, // Disable noise reduction to avoid over-processing small images
        targetDpi: 200, // Lower DPI to avoid scaling issues
        sharpen: false, // Disable sharpening for small images
        grayscale: true,
      });
    } catch (error) {
      console.warn('Image preprocessing failed, using original image:', error.message);
      processedBuffer = buffer;
    }
  }

  // Create Tesseract worker
  const worker = await createWorker(languages);
  
  // Set Arabic-specific optimization parameters
  if (isArabicOCR) {
    await worker.setParameters({
      preserve_interword_spaces: '1',
      // Arabic-specific Tesseract parameters for better recognition
      textord_heavy_nr: '1',
      textord_debug_tabfind: '0',
      // Improve Arabic character recognition
      classify_enable_learning: '0',
      classify_enable_adaptive_matcher: '1',
      // Handle right-to-left text better
      textord_really_old_xheight: '1',
      textord_tabfind_show_vlines: '0',
      // Page segmentation mode - try AUTO first for better results
      tessedit_pageseg_mode: PSM.AUTO,
      // Additional Arabic-specific parameters
      tessedit_char_whitelist: '', // Don't restrict characters for Arabic
      tessedit_char_blacklist: '', // Don't blacklist any characters
      // Improve word recognition
      textord_min_linesize: '1.25',
      // Better handling of Arabic script
      textord_tabfind_force_vertical_text: '0',
      // Optimize for Arabic text direction
      bidi_debug: '0',
    });
  }

  const { data: { text, confidence } } = await worker.recognize(processedBuffer);
  await worker.terminate();
  
  // Post-process Arabic text if detected
  let processedText = text;
  if (isArabicOCR && containsArabic(text)) {
    try {
      processedText = postprocessArabicOCR(text);
    } catch (error) {
      console.warn('Arabic text post-processing failed, using raw OCR output:', error.message);
      processedText = text;
    }
  }
  
  // Log confidence for debugging and provide suggestions
  if (confidence < 70) {
    console.warn(`Low OCR confidence: ${confidence}% for languages: ${languages.join(', ')}`);
    if (isArabicOCR) {
      console.info('For better Arabic OCR results, try:');
      console.info('- Higher resolution images (300+ DPI)');
      console.info('- Better contrast and lighting');
      console.info('- Cleaner text without noise or artifacts');
    }
  }

  return processedText;
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
