import { Buffer } from 'node:buffer';
import { createWorker, PSM, OEM } from 'tesseract.js';
import { containsArabic, postprocessArabicOCR } from './arabic-text-processor';

/**
 * Fallback OCR strategies for when primary Arabic OCR fails
 */

export interface OCRFallbackResult {
  text: string;
  confidence: number;
  method: string;
  success: boolean;
}

/**
 * Tries OCR with different language combinations for better Arabic results
 */
export async function tryMultiLanguageOCR(
  buffer: Buffer,
  primaryLanguages: string[]
): Promise<OCRFallbackResult[]> {
  const results: OCRFallbackResult[] = [];
  
  // Different language combinations to try
  const languageCombinations = [
    ['ara'], // Arabic only
    ['ara', 'eng'], // Arabic + English
    ['eng', 'ara'], // English primary, Arabic secondary
  ];
  
  for (const languages of languageCombinations) {
    try {
      console.log(`Trying OCR with languages: ${languages.join(', ')}`);
      
      // Create worker with LSTM_ONLY mode for Arabic
      const worker = languages[0] === 'ara' 
        ? await createWorker(languages, OEM.LSTM_ONLY)
        : await createWorker(languages);
      
      // Optimize for the primary language
      if (languages[0] === 'ara') {
        await worker.setParameters({
          preserve_interword_spaces: '1',
          tessedit_pageseg_mode: PSM.AUTO,
          classify_enable_adaptive_matcher: '1',
          textord_heavy_nr: '1',
          // Enable Arabic script optimizations
          textord_really_old_xheight: '0',
          textord_tabfind_force_vertical_text: '0',
          // Language model settings
          language_model_penalty_non_freq_dict_word: '0.1',
          language_model_penalty_non_dict_word: '0.15',
        });
      }
      
      const { data: { text, confidence } } = await worker.recognize(buffer);
      await worker.terminate();
      
      let processedText = text;
      if (languages.includes('ara') && containsArabic(text)) {
        try {
          processedText = postprocessArabicOCR(text);
        } catch (error) {
          console.warn('Post-processing failed for', languages.join(','), error.message);
        }
      }
      
      results.push({
        text: processedText,
        confidence: confidence || 0,
        method: `languages_${languages.join('_')}`,
        success: true,
      });
      
      console.log(`Languages ${languages.join(', ')}: ${confidence}% confidence`);
      
    } catch (error) {
      console.warn(`Language combination ${languages.join(', ')} failed:`, error instanceof Error ? error.message : String(error));
      results.push({
        text: '',
        confidence: 0,
        method: `languages_${languages.join('_')}`,
        success: false,
      });
    }
  }
  
  return results;
}

/**
 * Tries OCR with different OEM (OCR Engine Mode) settings
 */
export async function tryDifferentOEModes(
  buffer: Buffer,
  languages: string[]
): Promise<OCRFallbackResult[]> {
  const results: OCRFallbackResult[] = [];
  
  // Different OEM modes to try
  const oemModes = [
    { mode: OEM.LSTM_ONLY, name: 'lstm_only' },
    { mode: OEM.TESSERACT_LSTM_COMBINED, name: 'combined' },
    { mode: OEM.DEFAULT, name: 'default' },
  ];
  
  for (const { mode, name } of oemModes) {
    try {
      console.log(`Trying OCR with OEM mode: ${name}`);
      
      const worker = await createWorker(languages, mode);
      
      await worker.setParameters({
        preserve_interword_spaces: '1',
        tessedit_pageseg_mode: PSM.AUTO,
        // Arabic-specific settings
        ...(languages.includes('ara') && {
          classify_enable_adaptive_matcher: '1',
          textord_heavy_nr: '1',
        }),
      });
      
      const { data: { text, confidence } } = await worker.recognize(buffer);
      await worker.terminate();
      
      let processedText = text;
      if (languages.includes('ara') && containsArabic(text)) {
        try {
          processedText = postprocessArabicOCR(text);
        } catch (error) {
          console.warn('Post-processing failed for OEM', name, error.message);
        }
      }
      
      results.push({
        text: processedText,
        confidence: confidence || 0,
        method: `oem_${name}`,
        success: true,
      });
      
      console.log(`OEM ${name}: ${confidence}% confidence`);
      
    } catch (error) {
      console.warn(`OEM mode ${name} failed:`, error instanceof Error ? error.message : String(error));
      results.push({
        text: '',
        confidence: 0,
        method: `oem_${name}`,
        success: false,
      });
    }
  }
  
  return results;
}

/**
 * Comprehensive fallback OCR that tries multiple approaches
 */
export async function performComprehensiveArabicOCR(
  buffer: Buffer,
  languages: string[]
): Promise<OCRFallbackResult> {
  console.log('Starting comprehensive Arabic OCR fallback...');
  
  const allResults: OCRFallbackResult[] = [];
  
  // Try different language combinations
  const languageResults = await tryMultiLanguageOCR(buffer, languages);
  allResults.push(...languageResults);
  
  // Try different OEM modes with original languages
  const oemResults = await tryDifferentOEModes(buffer, languages);
  allResults.push(...oemResults);
  
  // Find the best result
  const successfulResults = allResults.filter(r => r.success && r.confidence > 0);
  
  if (successfulResults.length === 0) {
    return {
      text: '',
      confidence: 0,
      method: 'all_failed',
      success: false,
    };
  }
  
  // Sort by confidence and return the best
  const bestResult = successfulResults.sort((a, b) => b.confidence - a.confidence)[0]!;
  
  console.log(`Best fallback result: ${bestResult.confidence}% confidence using ${bestResult.method}`);
  
  return bestResult;
}