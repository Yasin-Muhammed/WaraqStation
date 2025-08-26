// Import Arabic processing libraries with fallback handling
let ArabicReshaper: any = null;
let Bidi: any = null;

try {
  ArabicReshaper = require('arabic-reshaper');
} catch (error) {
  console.warn('Arabic reshaper library not available, text reshaping will be skipped');
}

try {
  const bidiModule = require('bidi');
  Bidi = bidiModule.Bidi || bidiModule;
} catch (error) {
  console.warn('Bidi library not available, bidirectional text processing will be skipped');
}

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
    let processedText = text;
    
    // Only attempt reshaping if the library is available
    if (ArabicReshaper && typeof ArabicReshaper === 'function') {
      processedText = ArabicReshaper(text, {
        // Enable ligature support
        ligatures: true,
        // Support for Persian/Farsi characters
        support_persian: true,
        // Support for Urdu characters
        support_urdu: true,
      });
    }
    
    // Apply bidirectional text algorithm if available
    if (Bidi) {
      try {
        if (typeof Bidi === 'function') {
          const bidiInstance = new Bidi();
          if (bidiInstance.logicalToVisual) {
            processedText = bidiInstance.logicalToVisual(processedText);
          }
        } else if (Bidi.logicalToVisual) {
          processedText = Bidi.logicalToVisual(processedText);
        }
      } catch (bidiError) {
        console.warn('Bidi processing failed, continuing without it:', bidiError.message);
      }
    }
    
    return processedText;
  } catch (error) {
    console.warn('Arabic text reshaping failed, using normalized text:', error.message);
    // Return normalized text without reshaping if reshaping fails
    return normalizeArabicText(text);
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
  // Import text enhancer dynamically to avoid circular imports
  const { enhanceArabicTextQuality, reconstructArabicText, scoreArabicTextQuality } = require('./arabic-text-enhancer');
  
  // Step 1: Normalize the OCR output
  let processed = normalizeArabicText(ocrOutput);
  
  // Step 2: Fix common OCR errors for Arabic
  processed = fixCommonArabicOCRErrors(processed);
  
  // Step 3: Enhance text quality using advanced corrections
  try {
    processed = enhanceArabicTextQuality(processed);
  } catch (error) {
    console.warn('Arabic text enhancement failed:', error.message);
  }
  
  // Step 4: Reconstruct text using context
  try {
    processed = reconstructArabicText(processed);
  } catch (error) {
    console.warn('Arabic text reconstruction failed:', error.message);
  }
  
  // Step 5: Reshape for proper display
  processed = reshapeArabicText(processed);
  
  // Step 6: Score and report quality
  try {
    const quality = scoreArabicTextQuality(processed);
    console.log(`Arabic text quality score: ${quality.score}%`);
    if (quality.issues.length > 0) {
      console.warn('Text quality issues:', quality.issues);
      console.info('Suggestions:', quality.suggestions);
    }
  } catch (error) {
    console.warn('Text quality scoring failed:', error.message);
  }
  
  return processed;
}

/**
 * Fixes common OCR errors specific to Arabic text
 */
function fixCommonArabicOCRErrors(text: string): string {
  const commonErrors = [
    // Common character misrecognitions in Arabic OCR
    { from: /[o0O]/g, to: '٠' }, // ASCII digits to Arabic-Indic when in Arabic context
    { from: /[1l]/g, to: '١' },
    { from: /2/g, to: '٢' },
    { from: /3/g, to: '٣' },
    { from: /4/g, to: '٤' },
    { from: /5/g, to: '٥' },
    { from: /6/g, to: '٦' },
    { from: /7/g, to: '٧' },
    { from: /8/g, to: '٨' },
    { from: /9/g, to: '٩' },
    
    // Fix common Arabic letter OCR mistakes
    { from: /ﻊ/g, to: 'ع' }, // Different forms of Ain
    { from: /ﻋ/g, to: 'ع' },
    { from: /ﻌ/g, to: 'ع' },
    { from: /ﻋ/g, to: 'ع' },
    
    { from: /ﺡ/g, to: 'ح' }, // Different forms of Hah
    { from: /ﺣ/g, to: 'ح' },
    { from: /ﺤ/g, to: 'ح' },
    { from: /ﺣ/g, to: 'ح' },
    
    { from: /ﺭ/g, to: 'ر' }, // Different forms of Reh
    { from: /ﺮ/g, to: 'ر' },
    
    { from: /ﺱ/g, to: 'س' }, // Different forms of Seen
    { from: /ﺳ/g, to: 'س' },
    { from: /ﺴ/g, to: 'س' },
    { from: /ﺳ/g, to: 'س' },
    
    { from: /ﻡ/g, to: 'م' }, // Different forms of Meem
    { from: /ﻣ/g, to: 'م' },
    { from: /ﻤ/g, to: 'م' },
    { from: /ﻣ/g, to: 'م' },
    
    { from: /ﻥ/g, to: 'ن' }, // Different forms of Noon
    { from: /ﻧ/g, to: 'ن' },
    { from: /ﻨ/g, to: 'ن' },
    { from: /ﻧ/g, to: 'ن' },
    
    { from: /ﻝ/g, to: 'ل' }, // Different forms of Lam
    { from: /ﻟ/g, to: 'ل' },
    { from: /ﻠ/g, to: 'ل' },
    { from: /ﻟ/g, to: 'ل' },
    
    { from: /ﻙ/g, to: 'ك' }, // Different forms of Kaf
    { from: /ﻛ/g, to: 'ك' },
    { from: /ﻜ/g, to: 'ك' },
    { from: /ﻛ/g, to: 'ك' },
    
    { from: /ﻱ/g, to: 'ي' }, // Different forms of Yeh
    { from: /ﻳ/g, to: 'ي' },
    { from: /ﻴ/g, to: 'ي' },
    { from: /ﻳ/g, to: 'ي' },
    
    // Fix common OCR confusion between similar characters
    { from: /[ﺀ]/g, to: 'ء' }, // Hamza
    { from: /[ﺁآ]/g, to: 'آ' }, // Alef with Madda
    { from: /[ﺃأ]/g, to: 'أ' }, // Alef with Hamza above
    { from: /[ﺇإ]/g, to: 'إ' }, // Alef with Hamza below
    { from: /[ﺍا]/g, to: 'ا' }, // Alef
    
    // Fix spacing issues
    { from: /\s*،\s*/g, to: '، ' }, // Arabic comma
    { from: /\s*؛\s*/g, to: '؛ ' }, // Arabic semicolon
    { from: /\s*؟\s*/g, to: '؟ ' }, // Arabic question mark
    { from: /\s*!\s*/g, to: '! ' }, // Exclamation mark
    
    // Remove excessive spaces
    { from: /\s{3,}/g, to: '  ' }, // Multiple spaces to double space
    { from: /\s{2,}/g, to: ' ' },  // Double spaces to single space
    
    // Fix line breaks
    { from: /\n\s*\n/g, to: '\n' }, // Remove empty lines
    { from: /([^\n])\n([^\n])/g, to: '$1 $2' }, // Join broken words
  ];
  
  let fixed = text;
  
  // Only apply Arabic-specific fixes if text contains Arabic
  if (containsArabic(text)) {
    for (const error of commonErrors) {
      fixed = fixed.replace(error.from, error.to);
    }
    
    // Additional Arabic-specific corrections
    fixed = fixArabicWordBoundaries(fixed);
    fixed = fixArabicLigatures(fixed);
  }
  
  return fixed.trim();
}

/**
 * Fixes Arabic word boundaries that might be broken by OCR
 */
function fixArabicWordBoundaries(text: string): string {
  // Fix broken words by looking for Arabic character patterns
  return text
    // Fix broken words with Arabic letters
    .replace(/([ا-ي])\s+([ا-ي])/g, (match, char1, char2) => {
      // Check if this looks like a broken word
      if (char1.length === 1 && char2.length === 1) {
        return char1 + char2; // Join single characters
      }
      return match;
    })
    // Fix broken definite article (ال)
    .replace(/ا\s+ل\s+/g, 'ال')
    // Fix broken common prefixes
    .replace(/و\s+([ا-ي])/g, 'و$1')
    .replace(/ب\s+([ا-ي])/g, 'ب$1')
    .replace(/ل\s+([ا-ي])/g, 'ل$1')
    .replace(/ك\s+([ا-ي])/g, 'ك$1');
}

/**
 * Fixes Arabic ligatures that might be misrecognized
 */
function fixArabicLigatures(text: string): string {
  const ligatureFixes = [
    // Common ligature fixes
    { from: /لا/g, to: 'لا' }, // Lam-Alef ligature
    { from: /لآ/g, to: 'لآ' }, // Lam-Alef with Madda
    { from: /لأ/g, to: 'لأ' }, // Lam-Alef with Hamza above
    { from: /لإ/g, to: 'لإ' }, // Lam-Alef with Hamza below
  ];
  
  let fixed = text;
  for (const ligature of ligatureFixes) {
    fixed = fixed.replace(ligature.from, ligature.to);
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