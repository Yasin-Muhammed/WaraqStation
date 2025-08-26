/**
 * Arabic text processing utilities for search optimization
 */

// Arabic text normalization patterns for search
const ARABIC_SEARCH_NORMALIZATION_PATTERNS = [
  // Normalize different forms of Alef
  { from: /[آأإٱ]/g, to: 'ا' },
  // Normalize different forms of Yeh
  { from: /[يى]/g, to: 'ي' },
  // Normalize different forms of Teh Marbuta
  { from: /[ةه]/g, to: 'ة' },
  // Remove diacritics (Tashkeel) for search
  { from: /[\u064B-\u065F\u0670\u06D6-\u06ED]/g, to: '' },
  // Normalize Hamza
  { from: /[ؤئ]/g, to: 'ء' },
  // Remove Tatweel (kashida) for search
  { from: /\u0640/g, to: '' },
  // Normalize Arabic punctuation for search
  { from: /[،؛؟]/g, to: ' ' },
];

/**
 * Normalizes Arabic text for search indexing and querying
 */
export function normalizeArabicForSearch(text: string): string {
  let normalized = text;
  
  // Apply normalization patterns
  for (const pattern of ARABIC_SEARCH_NORMALIZATION_PATTERNS) {
    normalized = normalized.replace(pattern.from, pattern.to);
  }
  
  // Remove extra whitespace and normalize
  normalized = normalized.replace(/\s+/g, ' ').trim().toLowerCase();
  
  return normalized;
}

/**
 * Detects if text contains Arabic characters
 */
export function containsArabic(text: string): boolean {
  // Arabic Unicode blocks
  const arabicRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/;
  return arabicRegex.test(text);
}

/**
 * Tokenizes Arabic text for search indexing
 */
export function tokenizeArabicText(text: string): string[] {
  // Normalize first
  const normalized = normalizeArabicForSearch(text);
  
  // Split on whitespace and Arabic punctuation
  const tokens = normalized.split(/[\s\u060C\u061B\u061F\u0640]+/).filter(token => token.length > 0);
  
  // Generate additional tokens for better search
  const enhancedTokens = new Set(tokens);
  
  // Add root-based tokens (simplified approach)
  tokens.forEach(token => {
    if (token && token.length >= 3 && containsArabic(token)) {
      // Add prefixes and suffixes as separate tokens for better matching
      enhancedTokens.add(token);
      
      // Add token without common prefixes (ال, و, ب, ل, ك)
      const withoutPrefixes = token.replace(/^(ال|و|ب|ل|ك)/, '');
      if (withoutPrefixes !== token && withoutPrefixes.length >= 2) {
        enhancedTokens.add(withoutPrefixes);
      }
      
      // Add token without common suffixes (ها, ان, ات, ون, ين)
      const withoutSuffixes = token.replace(/(ها|ان|ات|ون|ين)$/, '');
      if (withoutSuffixes !== token && withoutSuffixes.length >= 2) {
        enhancedTokens.add(withoutSuffixes);
      }
    }
  });
  
  return Array.from(enhancedTokens);
}

/**
 * Prepares Arabic search query for FTS5
 */
export function prepareArabicSearchQuery(query: string): string {
  // Normalize the query
  const normalized = normalizeArabicForSearch(query);
  
  if (!normalized.trim()) {
    return '';
  }
  
  // Tokenize the query
  const tokens = tokenizeArabicText(normalized);
  
  if (tokens.length === 0) {
    return '';
  }
  
  // For single word queries, add wildcard for prefix matching
  if (tokens.length === 1) {
    const token = tokens[0];
    if (token && containsArabic(token)) {
      // For Arabic text, create multiple search variants
      const variants = [
        `"${token}"`,  // Exact match
        `${token}*`,   // Prefix match
      ];
      
      // Add variants without common prefixes/suffixes
      const withoutPrefixes = token.replace(/^(ال|و|ب|ل|ك)/, '');
      if (withoutPrefixes !== token && withoutPrefixes.length >= 2) {
        variants.push(`"${withoutPrefixes}"`);
        variants.push(`${withoutPrefixes}*`);
      }
      
      return variants.join(' OR ');
    } else if (token) {
      // Non-Arabic single word
      return `${token}*`;
    }
  }
  
  // For multi-word queries, create phrase and individual word searches
  const exactPhrase = `"${normalized}"`;
  const individualWords = tokens.map(token => {
    if (token && containsArabic(token)) {
      return `(${token}* OR "${token}")`;
    } else if (token) {
      return `${token}*`;
    }
    return '';
  }).filter(Boolean).join(' AND ');
  
  return individualWords ? `(${exactPhrase}) OR (${individualWords})` : exactPhrase;
}

/**
 * Highlights Arabic text matches in search results
 */
export function highlightArabicMatches(text: string, searchTerms: string[]): string {
  let highlighted = text;
  
  searchTerms.forEach(term => {
    const normalizedTerm = normalizeArabicForSearch(term);
    if (!normalizedTerm) return;
    
    // Create a regex that matches the normalized term in the original text
    const regex = new RegExp(
      normalizedTerm.split('').map(char => {
        // Escape special regex characters
        const escaped = char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // For Arabic characters, also match with diacritics
        if (/[\u0600-\u06FF]/.test(char)) {
          return `${escaped}[\u064B-\u065F\u0670\u06D6-\u06ED]*`;
        }
        return escaped;
      }).join(''),
      'gi'
    );
    
    highlighted = highlighted.replace(regex, '<mark>$&</mark>');
  });
  
  return highlighted;
}

/**
 * Generates search suggestions for Arabic text
 */
export function generateArabicSearchSuggestions(query: string, existingTerms: string[]): string[] {
  const normalized = normalizeArabicForSearch(query);
  if (!normalized || !containsArabic(normalized)) {
    return [];
  }
  
  const suggestions = new Set<string>();
  
  // Find similar terms in existing content
  existingTerms.forEach(term => {
    const normalizedTerm = normalizeArabicForSearch(term);
    if (normalizedTerm.includes(normalized) || normalized.includes(normalizedTerm)) {
      suggestions.add(term);
    }
  });
  
  // Generate morphological variants
  const tokens = tokenizeArabicText(normalized);
  tokens.forEach(token => {
    if (token.length >= 3) {
      // Add common prefixes
      ['ال', 'و', 'ب', 'ل', 'ك'].forEach(prefix => {
        suggestions.add(prefix + token);
      });
      
      // Add common suffixes
      ['ها', 'ان', 'ات', 'ون', 'ين'].forEach(suffix => {
        suggestions.add(token + suffix);
      });
    }
  });
  
  return Array.from(suggestions).slice(0, 10); // Limit suggestions
}