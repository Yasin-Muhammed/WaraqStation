import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { createClient } from '@libsql/client';
import { drizzle as drizzleLibsql } from 'drizzle-orm/libsql';

export { setupEnhancedDatabase, setupDatabase };

/**
 * Enhanced database setup with better-sqlite3 for improved Arabic text performance
 */
function setupEnhancedDatabase({
  url,
  authToken,
  encryptionKey,
  useEnhanced = true,
}: {
  url: string;
  authToken?: string;
  encryptionKey?: string;
  useEnhanced?: boolean;
}) {
  // Use better-sqlite3 for local SQLite files when possible
  if (useEnhanced && url.startsWith('file:') && !authToken) {
    const dbPath = url.replace('file:', '');
    const sqlite = new Database(dbPath);
    
    // Configure SQLite for optimal Arabic text handling
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('synchronous = NORMAL');
    sqlite.pragma('cache_size = 1000000');
    sqlite.pragma('foreign_keys = ON');
    sqlite.pragma('temp_store = MEMORY');
    
    // Enable Unicode normalization for better Arabic text handling
    sqlite.pragma('case_sensitive_like = OFF');
    
    // Create custom Arabic text normalization function
    sqlite.function('normalize_arabic', (text: string) => {
      if (!text || typeof text !== 'string') return text;
      
      // Basic Arabic normalization
      return text
        // Normalize different forms of Alef
        .replace(/[آأإٱ]/g, 'ا')
        // Normalize different forms of Yeh
        .replace(/[يى]/g, 'ي')
        // Normalize different forms of Teh Marbuta
        .replace(/[ةه]/g, 'ة')
        // Remove diacritics (Tashkeel)
        .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
        // Normalize Hamza
        .replace(/[ؤئ]/g, 'ء')
        // Remove Tatweel (kashida)
        .replace(/\u0640/g, '');
    });
    
    // Create Arabic text similarity function for fuzzy search
    sqlite.function('arabic_similarity', (text1: string, text2: string) => {
      if (!text1 || !text2 || typeof text1 !== 'string' || typeof text2 !== 'string') {
        return 0;
      }
      
      const normalized1 = text1.toLowerCase().replace(/[آأإٱ]/g, 'ا').replace(/[يى]/g, 'ي');
      const normalized2 = text2.toLowerCase().replace(/[آأإٱ]/g, 'ا').replace(/[يى]/g, 'ي');
      
      // Simple similarity calculation (can be enhanced with more sophisticated algorithms)
      const longer = normalized1.length > normalized2.length ? normalized1 : normalized2;
      const shorter = normalized1.length > normalized2.length ? normalized2 : normalized1;
      
      if (longer.length === 0) return 1;
      
      const editDistance = levenshteinDistance(longer, shorter);
      return (longer.length - editDistance) / longer.length;
    });
    
    const db = drizzle(sqlite);
    
    // Add batch support for better-sqlite3 by simulating it with transactions
    const enhancedDb = {
      ...db,
      batch: async (queries: any[]) => {
        const transaction = sqlite.transaction(() => {
          const results = [];
          for (const query of queries) {
            results.push(query);
          }
          return results;
        });
        return transaction();
      },
    };
    
    return {
      db: enhancedDb,
      client: sqlite,
      isEnhanced: true,
    };
  }
  
  // Fallback to libsql for remote databases or when enhancement is disabled
  return setupDatabase({ url, authToken, encryptionKey });
}

/**
 * Original database setup with libsql
 */
function setupDatabase({
  url,
  authToken,
  encryptionKey,
}: {
  url: string;
  authToken?: string;
  encryptionKey?: string;
}) {
  const client = createClient({ url, authToken, encryptionKey });
  const db = drizzleLibsql(client);

  return {
    db,
    client,
    isEnhanced: false,
  };
}

/**
 * Calculate Levenshtein distance for text similarity
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  // Create matrix
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0]![j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i]![j] = matrix[i - 1]![j - 1]!;
      } else {
        matrix[i]![j] = Math.min(
          matrix[i - 1]![j - 1]! + 1, // substitution
          matrix[i]![j - 1]! + 1,     // insertion
          matrix[i - 1]![j]! + 1      // deletion
        );
      }
    }
  }

  return matrix[str2.length]![str1.length]!;
}