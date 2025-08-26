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
    // Validate image quality
    const validation = await validateImageForOCR(buffer);
    if (!validation.isValid) {
      console.warn('Image quality issues detected:', validation.issues);
      console.info('Recommendations:', validation.recommendations);
    }
    
    // Preprocess image for optimal Arabic OCR
    processedBuffer = await preprocessArabicDocument(buffer, {
      enhanceContrast: true,
      reduceNoise: true,
      targetDpi: 300,
      sharpen: true,
      grayscale: true,
    });
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
      // Page segmentation mode for Arabic text
      tessedit_pageseg_mode: PSM.SINGLE_BLOCK, // Assume a single uniform block of text
    });
  }

  const { data: { text, confidence } } = await worker.recognize(processedBuffer);
  await worker.terminate();
  
  // Post-process Arabic text if detected
  let processedText = text;
  if (isArabicOCR && containsArabic(text)) {
    processedText = postprocessArabicOCR(text);
  }
  
  // Log confidence for debugging
  if (confidence < 70) {
    console.warn(`Low OCR confidence: ${confidence}% for languages: ${languages.join(', ')}`);
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
