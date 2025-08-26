export { ocrLanguages } from './config';

export {
  extractText,
  extractTextFromBlob,
  extractTextFromFile,
} from './extractors.usecases';

export {
  normalizeArabicText,
  reshapeArabicText,
  preprocessArabicForOCR,
  postprocessArabicOCR,
  containsArabic,
  extractArabicSegments,
} from './utils/arabic-text-processor';
