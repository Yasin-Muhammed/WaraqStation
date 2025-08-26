import ArabicReshaper from 'arabic-reshaper';
import bidi from 'bidi';

/**
 * Arabic text processing utilities for OCR enhancement
 */

// Arabic text normalization patterns
const ARABIC_NORMALIZATION_PATTERNS = [
  // Normalize different forms of Alef
  { from: /[آأإٱ]/g, to: 'ا' },
  // Normalize different forms of Yeh
  { from: /[يى]/g, to: 'ي' },
  // Normalize different forms of Teh Marbuta
  { from: /[ةه]/g, to: 'ة' },
  // Remove diacritics (Tashkeel)
  { from: /[\u064B-\u065F\u0670\u06D6-\u06ED]/g, to: '' },
  // Normalize Hamza
  { from: /[ؤئ]/g, to: 'ء' },
  // Remove Tatweel (kashida)
  { from: /\u0640/g, to: '' },
];

/**
 * Normalizes Arabic text by removing diacritics and standardizing character forms
 */
export function normalizeArabicText(text: string): string {
  let normalized = text;
  
  // Apply normalization patterns
  for (const pattern of ARABIC_NORMALIZATION_PATTERNS) {
    normalized = normalized.replace(pattern.from, pattern.to);
  }
  
  // Remove extra whitespace
  normalized = normalized.replace(/\s+/g, ' ').trim();
  
  return normalized;
}

/**
 * Reshapes Arabic text for proper display and processing
 */
export function reshapeArabicText(text: string): string {
  try {
    // Reshape Arabic text to handle proper character connections
    const reshaped = ArabicReshaper(text, {
      // Enable ligature support
      ligatures: true,
      // Support for Persian/Farsi characters
      support_persian: true,
      // Support for Urdu characters
      support_urdu: true,
    });
    
    // Apply bidirectional text algorithm
    return bidi(reshaped, { dir: 'rtl' });
  } catch (error) {
    console.warn('Arabic text reshaping failed:', error);
    return text;
  }
}

/**
 * Processes Arabic text for optimal OCR recognition
 */
export function preprocessArabicForOCR(text: string): string {
  // First normalize the text
  const normalized = normalizeArabicText(text);
  
  // Then reshape for proper character connections
  return reshapeArabicText(normalized);
}

/**
 * Post-processes OCR output for Arabic text
 */
export function postprocessArabicOCR(ocrOutput: string): string {
  // Normalize the OCR output
  let processed = normalizeArabicText(ocrOutput);
  
  // Fix common OCR errors for Arabic
  processed = fixCommonArabicOCRErrors(processed);
  
  // Reshape for proper display
  processed = reshapeArabicText(processed);
  
  return processed;
}

/**
 * Fixes common OCR errors specific to Arabic text
 */
function fixCommonArabicOCRErrors(text: string): string {
  const commonErrors = [
    // Common character misrecognitions
    { from: /٠/g, to: '0' }, // Arabic-Indic digit zero to ASCII
    { from: /١/g, to: '1' }, // Arabic-Indic digit one to ASCII
    { from: /٢/g, to: '2' }, // Arabic-Indic digit two to ASCII
    { from: /٣/g, to: '3' }, // Arabic-Indic digit three to ASCII
    { from: /٤/g, to: '4' }, // Arabic-Indic digit four to ASCII
    { from: /٥/g, to: '5' }, // Arabic-Indic digit five to ASCII
    { from: /٦/g, to: '6' }, // Arabic-Indic digit six to ASCII
    { from: /٧/g, to: '7' }, // Arabic-Indic digit seven to ASCII
    { from: /٨/g, to: '8' }, // Arabic-Indic digit eight to ASCII
    { from: /٩/g, to: '9' }, // Arabic-Indic digit nine to ASCII
    
    // Fix spacing around Arabic punctuation
    { from: /\s*،\s*/g, to: '، ' }, // Arabic comma
    { from: /\s*؛\s*/g, to: '؛ ' }, // Arabic semicolon
    { from: /\s*؟\s*/g, to: '؟ ' }, // Arabic question mark
    { from: /\s*!\s*/g, to: '! ' }, // Exclamation mark
    
    // Fix common letter confusions
    { from: /ك/g, to: 'ك' }, // Ensure proper Kaf
    { from: /ي/g, to: 'ي' }, // Ensure proper Yeh
  ];
  
  let fixed = text;
  for (const error of commonErrors) {
    fixed = fixed.replace(error.from, error.to);
  }
  
  return fixed;
}

/**
 * Detects if text contains Arabic characters
 */
export function containsArabic(text: string): boolean {
  // Arabic Unicode block: U+0600-U+06FF
  // Arabic Supplement: U+0750-U+077F
  // Arabic Extended-A: U+08A0-U+08FF
  const arabicRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/;
  return arabicRegex.test(text);
}

/**
 * Extracts Arabic text segments from mixed-language text
 */
export function extractArabicSegments(text: string): string[] {
  const arabicSegments: string[] = [];
  const words = text.split(/\s+/);
  
  let currentSegment = '';
  for (const word of words) {
    if (containsArabic(word)) {
      currentSegment += (currentSegment ? ' ' : '') + word;
    } else if (currentSegment) {
      arabicSegments.push(currentSegment);
      currentSegment = '';
    }
  }
  
  if (currentSegment) {
    arabicSegments.push(currentSegment);
  }
  
  return arabicSegments;
}