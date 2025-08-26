/**
 * Advanced Arabic text enhancement and correction utilities
 */

import { containsArabic } from './arabic-text-processor';

/**
 * Arabic dictionary of common words for context-based correction
 */
const COMMON_ARABIC_WORDS = new Set([
  'في', 'من', 'إلى', 'على', 'هذا', 'هذه', 'التي', 'الذي', 'كان', 'كانت',
  'يكون', 'تكون', 'له', 'لها', 'لم', 'لن', 'قد', 'كل', 'بعض', 'عند',
  'عندما', 'حيث', 'حين', 'بين', 'خلال', 'أثناء', 'بعد', 'قبل', 'مع',
  'ضد', 'نحو', 'تجاه', 'حول', 'دون', 'سوى', 'غير', 'إلا', 'لكن', 'لكن',
  'أو', 'أم', 'لا', 'ما', 'لماذا', 'كيف', 'أين', 'متى', 'ماذا', 'من',
  'الله', 'رب', 'إسلام', 'مسلم', 'عربي', 'عرب', 'بلد', 'دولة', 'مدينة',
  'قرية', 'بيت', 'منزل', 'مكتب', 'مدرسة', 'جامعة', 'مستشفى', 'مطار',
  'محطة', 'سوق', 'متجر', 'مطعم', 'فندق', 'شارع', 'طريق', 'جسر', 'نهر',
  'بحر', 'جبل', 'صحراء', 'غابة', 'حديقة', 'ميدان', 'ساحة', 'مسجد',
  'كنيسة', 'معبد', 'مكتبة', 'متحف', 'مسرح', 'سينما', 'ملعب', 'حمام',
  'مطبخ', 'غرفة', 'صالة', 'شرفة', 'حديقة', 'موقف', 'مرآب', 'مصعد',
]);

/**
 * Enhances Arabic text quality using context-based corrections
 */
export function enhanceArabicTextQuality(text: string): string {
  if (!containsArabic(text)) {
    return text;
  }
  
  let enhanced = text;
  
  // Step 1: Fix character-level issues
  enhanced = fixArabicCharacterIssues(enhanced);
  
  // Step 2: Fix word-level issues
  enhanced = fixArabicWordIssues(enhanced);
  
  // Step 3: Fix sentence-level issues
  enhanced = fixArabicSentenceIssues(enhanced);
  
  // Step 4: Apply context-based corrections
  enhanced = applyContextBasedCorrections(enhanced);
  
  return enhanced.trim();
}

/**
 * Fixes character-level Arabic OCR issues
 */
function fixArabicCharacterIssues(text: string): string {
  return text
    // Fix isolated vs connected forms
    .replace(/ﺎ/g, 'ا') // Alef final form
    .replace(/ﺏ/g, 'ب') // Beh isolated
    .replace(/ﺑ/g, 'ب') // Beh initial
    .replace(/ﺒ/g, 'ب') // Beh medial
    .replace(/ﺐ/g, 'ب') // Beh final
    
    // Fix Teh forms
    .replace(/ﺕ/g, 'ت') // Teh isolated
    .replace(/ﺗ/g, 'ت') // Teh initial
    .replace(/ﺘ/g, 'ت') // Teh medial
    .replace(/ﺖ/g, 'ت') // Teh final
    
    // Fix Theh forms
    .replace(/ﺙ/g, 'ث') // Theh isolated
    .replace(/ﺛ/g, 'ث') // Theh initial
    .replace(/ﺜ/g, 'ث') // Theh medial
    .replace(/ﺚ/g, 'ث') // Theh final
    
    // Fix Jeem forms
    .replace(/ﺝ/g, 'ج') // Jeem isolated
    .replace(/ﺟ/g, 'ج') // Jeem initial
    .replace(/ﺠ/g, 'ج') // Jeem medial
    .replace(/ﺞ/g, 'ج') // Jeem final
    
    // Fix common OCR misrecognitions
    .replace(/[`']/g, 'ء') // Apostrophes to Hamza
    .replace(/[""]/g, '"') // Normalize quotes
    .replace(/['']/g, "'") // Normalize apostrophes
    
    // Fix spacing around diacritics
    .replace(/([ا-ي])\s+([\u064B-\u065F])/g, '$1$2');
}

/**
 * Fixes word-level Arabic OCR issues
 */
function fixArabicWordIssues(text: string): string {
  return text
    // Fix broken definite article
    .replace(/ا\s*ل\s*([ا-ي])/g, 'ال$1')
    
    // Fix broken prepositions
    .replace(/ب\s*([ا-ي])/g, 'ب$1')
    .replace(/ل\s*([ا-ي])/g, 'ل$1')
    .replace(/ك\s*([ا-ي])/g, 'ك$1')
    .replace(/و\s*([ا-ي])/g, 'و$1')
    .replace(/ف\s*([ا-ي])/g, 'ف$1')
    
    // Fix broken common words
    .replace(/م\s*ن/g, 'من')
    .replace(/ف\s*ي/g, 'في')
    .replace(/ع\s*ل\s*ى/g, 'على')
    .replace(/إ\s*ل\s*ى/g, 'إلى')
    .replace(/ه\s*ذ\s*ا/g, 'هذا')
    .replace(/ه\s*ذ\s*ه/g, 'هذه')
    .replace(/ذ\s*ل\s*ك/g, 'ذلك')
    .replace(/ت\s*ل\s*ك/g, 'تلك')
    
    // Fix broken pronouns
    .replace(/أ\s*ن\s*ا/g, 'أنا')
    .replace(/أ\s*ن\s*ت/g, 'أنت')
    .replace(/ه\s*و/g, 'هو')
    .replace(/ه\s*ي/g, 'هي')
    .replace(/ن\s*ح\s*ن/g, 'نحن')
    .replace(/أ\s*ن\s*ت\s*م/g, 'أنتم')
    .replace(/ه\s*م/g, 'هم')
    .replace(/ه\s*ن/g, 'هن');
}

/**
 * Fixes sentence-level Arabic OCR issues
 */
function fixArabicSentenceIssues(text: string): string {
  return text
    // Fix sentence boundaries
    .replace(/([ا-ي])\s*\.\s*([ا-ي])/g, '$1. $2')
    .replace(/([ا-ي])\s*،\s*([ا-ي])/g, '$1، $2')
    .replace(/([ا-ي])\s*؛\s*([ا-ي])/g, '$1؛ $2')
    .replace(/([ا-ي])\s*؟\s*([ا-ي])/g, '$1؟ $2')
    .replace(/([ا-ي])\s*!\s*([ا-ي])/g, '$1! $2')
    
    // Fix quotation marks
    .replace(/"\s*([ا-ي])/g, '"$1')
    .replace(/([ا-ي])\s*"/g, '$1"')
    
    // Fix parentheses
    .replace(/\(\s*([ا-ي])/g, '($1')
    .replace(/([ا-ي])\s*\)/g, '$1)')
    
    // Remove extra line breaks
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .replace(/\n\s+/g, '\n');
}

/**
 * Applies context-based corrections using common Arabic words
 */
function applyContextBasedCorrections(text: string): string {
  const words = text.split(/\s+/);
  const correctedWords = words.map(word => {
    // Remove punctuation for matching
    const cleanWord = word.replace(/[^\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/g, '');
    
    if (!containsArabic(cleanWord) || cleanWord.length < 2) {
      return word;
    }
    
    // Check for exact matches first
    if (COMMON_ARABIC_WORDS.has(cleanWord)) {
      return word; // Already correct
    }
    
    // Try to find close matches
    const closeMatch = findClosestArabicWord(cleanWord);
    if (closeMatch) {
      console.log(`Correcting Arabic word: "${cleanWord}" -> "${closeMatch}"`);
      return word.replace(cleanWord, closeMatch);
    }
    
    return word;
  });
  
  return correctedWords.join(' ');
}

/**
 * Finds the closest matching Arabic word from the dictionary
 */
function findClosestArabicWord(word: string): string | null {
  if (word.length < 2) return null;
  
  let bestMatch = null;
  let bestScore = 0;
  
  for (const dictWord of COMMON_ARABIC_WORDS) {
    if (Math.abs(dictWord.length - word.length) > 2) continue;
    
    const similarity = calculateArabicSimilarity(word, dictWord);
    if (similarity > bestScore && similarity > 0.7) {
      bestScore = similarity;
      bestMatch = dictWord;
    }
  }
  
  return bestMatch;
}

/**
 * Calculates similarity between two Arabic words
 */
function calculateArabicSimilarity(word1: string, word2: string): number {
  if (word1 === word2) return 1;
  if (word1.length === 0 || word2.length === 0) return 0;
  
  // Normalize both words for comparison
  const normalize = (w: string) => w
    .replace(/[آأإٱ]/g, 'ا')
    .replace(/[يى]/g, 'ي')
    .replace(/[ةه]/g, 'ة')
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '');
  
  const norm1 = normalize(word1);
  const norm2 = normalize(word2);
  
  if (norm1 === norm2) return 0.95;
  
  // Calculate character-level similarity
  const maxLen = Math.max(norm1.length, norm2.length);
  const minLen = Math.min(norm1.length, norm2.length);
  
  let matches = 0;
  for (let i = 0; i < minLen; i++) {
    if (norm1[i] === norm2[i]) {
      matches++;
    }
  }
  
  return matches / maxLen;
}

/**
 * Validates and scores Arabic text quality
 */
export function scoreArabicTextQuality(text: string): {
  score: number;
  issues: string[];
  suggestions: string[];
} {
  const issues: string[] = [];
  const suggestions: string[] = [];
  let score = 100;
  
  if (!containsArabic(text)) {
    return { score: 0, issues: ['No Arabic text detected'], suggestions: [] };
  }
  
  // Check for excessive broken words
  const brokenWordPattern = /([ا-ي])\s+([ا-ي])\s+([ا-ي])/g;
  const brokenWords = (text.match(brokenWordPattern) || []).length;
  if (brokenWords > 3) {
    score -= brokenWords * 5;
    issues.push('Many broken words detected');
    suggestions.push('Try higher resolution or better image quality');
  }
  
  // Check for excessive punctuation errors
  const punctuationErrors = (text.match(/[ا-ي][.!?][ا-ي]/g) || []).length;
  if (punctuationErrors > 2) {
    score -= punctuationErrors * 3;
    issues.push('Punctuation spacing issues');
    suggestions.push('Check for proper sentence boundaries');
  }
  
  // Check for mixed scripts issues
  const mixedScriptPattern = /[a-zA-Z][ا-ي]|[ا-ي][a-zA-Z]/g;
  const mixedIssues = (text.match(mixedScriptPattern) || []).length;
  if (mixedIssues > 2) {
    score -= mixedIssues * 2;
    issues.push('Mixed script boundary issues');
    suggestions.push('May need better language detection');
  }
  
  // Check text length (very short text might indicate poor OCR)
  if (text.trim().length < 10) {
    score -= 20;
    issues.push('Very short text extracted');
    suggestions.push('Ensure image contains readable text');
  }
  
  // Check for reasonable word count
  const arabicWords = text.split(/\s+/).filter(word => containsArabic(word));
  if (arabicWords.length === 0) {
    score -= 30;
    issues.push('No Arabic words found');
    suggestions.push('Check if image contains Arabic text');
  }
  
  return {
    score: Math.max(0, Math.min(100, score)),
    issues,
    suggestions,
  };
}

/**
 * Applies intelligent Arabic text reconstruction
 */
export function reconstructArabicText(text: string): string {
  if (!containsArabic(text)) {
    return text;
  }
  
  let reconstructed = text;
  
  // Apply enhancement
  reconstructed = enhanceArabicTextQuality(reconstructed);
  
  // Fix common patterns
  reconstructed = fixArabicPatterns(reconstructed);
  
  // Apply final cleanup
  reconstructed = finalArabicCleanup(reconstructed);
  
  return reconstructed;
}

/**
 * Fixes common Arabic text patterns
 */
function fixArabicPatterns(text: string): string {
  return text
    // Fix broken question words
    .replace(/م\s*ا\s*ذ\s*ا/g, 'ماذا')
    .replace(/ل\s*م\s*ا\s*ذ\s*ا/g, 'لماذا')
    .replace(/ك\s*ي\s*ف/g, 'كيف')
    .replace(/أ\s*ي\s*ن/g, 'أين')
    .replace(/م\s*ت\s*ى/g, 'متى')
    
    // Fix broken conjunctions
    .replace(/و\s*ل\s*ك\s*ن/g, 'ولكن')
    .replace(/ل\s*ك\s*ن/g, 'لكن')
    .replace(/أ\s*و/g, 'أو')
    .replace(/إ\s*ذ\s*ا/g, 'إذا')
    .replace(/إ\s*ذ/g, 'إذ')
    
    // Fix broken negations
    .replace(/ل\s*ا/g, 'لا')
    .replace(/ل\s*م/g, 'لم')
    .replace(/ل\s*ن/g, 'لن')
    .replace(/م\s*ا/g, 'ما')
    
    // Fix broken demonstratives
    .replace(/ه\s*ؤ\s*ل\s*ا\s*ء/g, 'هؤلاء')
    .replace(/أ\s*و\s*ل\s*ئ\s*ك/g, 'أولئك')
    .replace(/ه\s*ا\s*ت\s*ا\s*ن/g, 'هاتان')
    .replace(/ه\s*ذ\s*ا\s*ن/g, 'هذان');
}

/**
 * Final cleanup for Arabic text
 */
function finalArabicCleanup(text: string): string {
  return text
    // Remove extra spaces
    .replace(/\s+/g, ' ')
    
    // Fix spacing around punctuation
    .replace(/\s+([،؛؟!.])/g, '$1')
    .replace(/([،؛؟!.])\s+/g, '$1 ')
    
    // Fix quotation marks
    .replace(/\s*"\s*/g, '"')
    .replace(/"\s+([ا-ي])/g, '"$1')
    .replace(/([ا-ي])\s+"/g, '$1"')
    
    // Fix parentheses
    .replace(/\s*\(\s*/g, '(')
    .replace(/\s*\)\s*/g, ') ')
    .replace(/\(\s+([ا-ي])/g, '($1')
    .replace(/([ا-ي])\s+\)/g, '$1)')
    
    // Remove trailing/leading spaces
    .trim();
}