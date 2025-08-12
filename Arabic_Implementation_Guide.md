# Arabic Document Processing Implementation Guide for Papra

## Table of Contents
1. [System Overview](#system-overview)
2. [Current Arabic Support Status](#current-arabic-support-status)
3. [Implementation Roadmap](#implementation-roadmap)
4. [Phase 1: Foundation & OCR Enhancement](#phase-1-foundation--ocr-enhancement)
5. [Phase 2: Arabic Text Processing Pipeline](#phase-2-arabic-text-processing-pipeline)
6. [Phase 3: Enhanced Search & Indexing](#phase-3-enhanced-search--indexing)
7. [Phase 4: Frontend RTL Support](#phase-4-frontend-rtl-support)
8. [Phase 5: Arabic Language Interface](#phase-5-arabic-language-interface)
9. [Phase 6: Testing & Validation](#phase-6-testing--validation)
10. [Deployment & Configuration](#deployment--configuration)
11. [Performance Optimization](#performance-optimization)
12. [Troubleshooting](#troubleshooting)
13. [Additional Resources](#additional-resources)

---

## System Overview

**Papra** is a modern, TypeScript-based document management system with the following architecture:

### **Core Components**
- **Backend**: Node.js + HonoJS + Drizzle ORM + SQLite
- **Frontend**: SolidJS + UnoCSS + Shadcn Solid
- **Document Processing**: Custom `@papra/lecture` package using Tesseract.js
- **Search**: SQLite FTS5 (Full-Text Search)
- **Database**: SQLite with UTF-8 support
- **Storage**: File system + cloud storage (S3, Azure, Backblaze)

### **Key Technologies**
- **OCR Engine**: Tesseract.js with language pack support
- **Text Processing**: Custom Arabic text normalization
- **Search Engine**: SQLite FTS5 with Arabic text support
- **Database**: SQLite with UTF-8 encoding
- **Frontend**: SolidJS with RTL layout support

---

## Current Arabic Support Status

✅ **OCR Languages**: Arabic (`ara`) is already supported in the OCR_LANGUAGES constant  
✅ **Text Storage**: UTF-8 database encoding supports Arabic characters  
✅ **Search Engine**: FTS5 supports Arabic text indexing and searching  
❌ **Frontend RTL**: No right-to-left layout support  
❌ **Arabic-specific Processing**: No Arabic text normalization or preprocessing  
❌ **Arabic UI**: No Arabic language interface  

---

## Implementation Roadmap

### **Timeline: 6 Weeks**
- **Week 1-2**: Foundation & OCR Enhancement
- **Week 2-3**: Arabic Text Processing Pipeline
- **Week 3-4**: Enhanced Search & Indexing
- **Week 4-5**: Frontend RTL Support
- **Week 5-6**: Arabic Language Interface
- **Week 6**: Testing & Validation

---

## Phase 1: Foundation & OCR Enhancement

### **1.1 OCR Configuration Enhancement**

Update the documents configuration to include Arabic-specific settings:

```typescript
// apps/papra-server/src/modules/documents/documents.config.ts
import { z } from 'zod';

export const documentsConfig = {
  ocrLanguages: {
    doc: 'OCR languages with Arabic optimization',
    default: ['ara', 'eng'], // Arabic primary, English fallback
    schema: stringCoercedOcrLanguagesSchema,
    env: 'DOCUMENTS_OCR_LANGUAGES',
  },
  arabicOcr: {
    doc: 'Arabic OCR optimization settings',
    default: {
      enableRtlDetection: true,
      enableArabicNormalization: true,
      confidenceThreshold: 70,
    },
    schema: z.object({
      enableRtlDetection: z.boolean(),
      enableArabicNormalization: z.boolean(),
      confidenceThreshold: z.number().min(0).max(100),
    }),
    env: 'DOCUMENTS_ARABIC_OCR',
  },
};
```

### **1.2 Enhanced OCR Service**

Update the document text extraction service:

```typescript
// apps/papra-server/src/modules/documents/documents.services.ts
import { ArabicTextProcessor } from './arabic/arabic-text-processor';

export async function extractDocumentText({
  file,
  ocrLanguages,
  arabicOcrConfig,
  logger = createLogger({ namespace: 'documents:services' }),
}: {
  file: File;
  ocrLanguages?: string[];
  arabicOcrConfig?: ArabicOcrConfig;
  logger?: Logger;
}) {
  const { textContent, error, extractorName } = await extractTextFromFile({ 
    file, 
    config: { 
      tesseract: { 
        languages: ocrLanguages,
        config: arabicOcrConfig?.enableRtlDetection ? '--psm 6 -c preserve_interword_spaces=1' : undefined,
      } 
    } 
  });

  if (error) {
    logger.error({ error, extractorName }, 'Error while extracting text from document');
  }

  let processedText = textContent ?? '';
  
  // Apply Arabic text processing if enabled
  if (arabicOcrConfig?.enableArabicNormalization && isArabicText(processedText)) {
    const arabicProcessor = new ArabicTextProcessor();
    processedText = await arabicProcessor.normalizeText(processedText);
  }

  return { text: processedText };
}

function isArabicText(text: string): boolean {
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
}
```

---

## Phase 2: Arabic Text Processing Pipeline

### **2.1 Arabic Text Processor**

Create the main Arabic text processing class:

```typescript
// apps/papra-server/src/modules/documents/arabic/arabic-text-processor.ts
export class ArabicTextProcessor {
  private normalizer: ArabicTextNormalizer;
  private tokenizer: ArabicTokenizer;
  private stemmer: ArabicStemmer;

  constructor() {
    this.normalizer = new ArabicTextNormalizer();
    this.tokenizer = new ArabicTokenizer();
    this.stemmer = new ArabicStemmer();
  }

  async normalizeText(text: string): Promise<string> {
    // Remove diacritics (tashkeel)
    let normalized = this.normalizer.removeDiacritics(text);
    
    // Normalize Arabic characters
    normalized = this.normalizer.normalizeCharacters(normalized);
    
    // Clean whitespace
    normalized = this.normalizer.cleanWhitespace(normalized);
    
    return normalized;
  }

  async extractArabicDates(text: string): Promise<Date[]> {
    const dateExtractor = new ArabicDateExtractor();
    return dateExtractor.extractDates(text);
  }

  async extractArabicNumbers(text: string): Promise<number[]> {
    const numberExtractor = new ArabicNumberExtractor();
    return numberExtractor.extractNumbers(text);
  }
}
```

### **2.2 Arabic Text Normalizer**

```typescript
// apps/papra-server/src/modules/documents/arabic/arabic-text-normalizer.ts
export class ArabicTextNormalizer {
  removeDiacritics(text: string): string {
    // Remove Arabic diacritical marks
    return text.replace(/[\u064B-\u065F\u0670]/g, '');
  }

  normalizeCharacters(text: string): string {
    // Standardize Arabic character variations
    const replacements: Record<string, string> = {
      'أ': 'ا', 'إ': 'ا', 'آ': 'ا', // Alif variations
      'ة': 'ه', // Ta marbuta to ha
      'ى': 'ي', // Alif maqsura to ya
      'ؤ': 'و', // Hamza on waw
      'ئ': 'ي', // Hamza on ya
    };

    let normalized = text;
    for (const [old, new_] of Object.entries(replacements)) {
      normalized = normalized.replace(new RegExp(old, 'g'), new_);
    }

    return normalized;
  }

  cleanWhitespace(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .replace(/\u00A0/g, ' ') // Non-breaking space
      .trim();
  }
}
```

### **2.3 Arabic Date Extractor**

```typescript
// apps/papra-server/src/modules/documents/arabic/arabic-date-extractor.ts
export class ArabicDateExtractor {
  private arabicMonths: Record<string, number> = {
    'يناير': 1, 'فبراير': 2, 'مارس': 3, 'أبريل': 4,
    'مايو': 5, 'يونيو': 6, 'يوليو': 7, 'أغسطس': 8,
    'سبتمبر': 9, 'أكتوبر': 10, 'نوفمبر': 11, 'ديسمبر': 12
  };

  private arabicNumbers: Record<string, string> = {
    '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
    '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9'
  };

  extractDates(text: string): Date[] {
    const dates: Date[] = [];
    
    // Convert Arabic numbers to Latin
    let processedText = text;
    for (const [arabic, latin] of Object.entries(this.arabicNumbers)) {
      processedText = processedText.replace(new RegExp(arabic, 'g'), latin);
    }

    // Date patterns
    const patterns = [
      /(\d{1,2})\s+(يناير|فبراير|مارس|أبريل|مايو|يونيو|يوليو|أغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر)\s+(\d{4})/g,
      /(\d{4})\/(\d{1,2})\/(\d{1,2})/g,
      /(\d{1,2})\/(\d{1,2})\/(\d{4})/g,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(processedText)) !== null) {
        try {
          const date = this.parseDateMatch(match, pattern);
          if (date) dates.push(date);
        } catch (error) {
          // Skip invalid dates
        }
      }
    }

    return dates;
  }

  private parseDateMatch(match: RegExpExecArray, pattern: RegExp): Date | null {
    if (pattern.source.includes('يناير')) {
      const day = parseInt(match[1]);
      const monthName = match[2];
      const year = parseInt(match[3]);
      const month = this.arabicMonths[monthName];
      return new Date(year, month - 1, day);
    } else {
      const [year, month, day] = match.slice(1).map(Number);
      return new Date(year, month - 1, day);
    }
  }
}
```

---

## Phase 3: Enhanced Search & Indexing

### **3.1 Arabic-Aware FTS5 Configuration**

Create enhanced FTS5 tables with Arabic support:

```sql
-- Enhanced FTS5 table with Arabic support
CREATE VIRTUAL TABLE documents_fts_arabic USING fts5(
  id UNINDEXED,
  name,
  original_name,
  content,
  content_arabic, -- Arabic-specific content field
  prefix='2 3 4',
  tokenize='porter unicode61'
);

-- Insert Arabic-specific content
INSERT INTO documents_fts_arabic(id, name, original_name, content, content_arabic)
SELECT 
  id, 
  name, 
  original_name, 
  content,
  CASE 
    WHEN content REGEXP '[\u0600-\u06FF]' THEN content
    ELSE ''
  END as content_arabic
FROM documents;
```

### **3.2 Enhanced Search Repository**

```typescript
// apps/papra-server/src/modules/documents/documents.repository.ts
async function searchOrganizationDocuments({
  organizationId, 
  searchQuery, 
  pageIndex, 
  pageSize, 
  searchOptions = {},
  db 
}: {
  organizationId: string;
  searchQuery: string;
  pageIndex: number;
  pageSize: number;
  searchOptions?: {
    enableArabicSearch?: boolean;
    arabicFuzzyMatch?: boolean;
    searchInArabicOnly?: boolean;
  };
  db: Database;
}) {
  const { enableArabicSearch = true, arabicFuzzyMatch = false, searchInArabicOnly = false } = searchOptions;
  
  // Detect if query contains Arabic
  const isArabicQuery = /[\u0600-\u06FF]/.test(searchQuery);
  
  let searchTable = 'documents_fts';
  let searchField = 'content';
  
  if (isArabicQuery && enableArabicSearch) {
    searchTable = 'documents_fts_arabic';
    searchField = searchInArabicOnly ? 'content_arabic' : 'content';
  }

  // Clean and format search query
  const cleanedQuery = this.cleanSearchQuery(searchQuery, isArabicQuery);
  const formattedQuery = this.formatSearchQuery(cleanedQuery, isArabicQuery, arabicFuzzyMatch);

  const result = await db.run(sql`
    SELECT * FROM ${documentsTable}
    JOIN ${searchTable} ON ${searchTable}.id = ${documentsTable.id}
    WHERE ${documentsTable.organizationId} = ${organizationId}
          AND ${documentsTable.isDeleted} = 0
          AND ${searchTable} MATCH ${formattedQuery}
    ORDER BY rank
    LIMIT ${pageSize}
    OFFSET ${pageIndex * pageSize}
  `);

  return {
    documents: result.rows as unknown as (typeof documentsTable.$inferSelect)[],
  };
}

private cleanSearchQuery(query: string, isArabic: boolean): string {
  if (isArabic) {
    return query.replace(/[\u064B-\u065F\u0670]/g, '');
  }
  return query.replace(/"/g, '').replace(/\*/g, '').trim();
}

private formatSearchQuery(query: string, isArabic: boolean, fuzzyMatch: boolean): string {
  if (isArabic && fuzzyMatch) {
    return `${query}~`;
  }
  
  if (query.includes(' ')) {
    return query;
  }
  
  return `${query}*`;
}
```

---

## Phase 4: Frontend RTL Support

### **4.1 RTL Layout Provider**

```typescript
// apps/papra-client/src/modules/layout/rtl.provider.tsx
import { createContext, createSignal, useContext, JSX } from 'solid-js';

interface RTLContextType {
  isRTL: () => boolean;
  direction: () => 'ltr' | 'rtl';
  setRTL: (rtl: boolean) => void;
  detectRTL: (text: string) => boolean;
}

const RTLContext = createContext<RTLContextType>();

export function RTLProvider(props: { children: JSX.Element }) {
  const [isRTL, setIsRTL] = createSignal(false);

  const direction = () => isRTL() ? 'rtl' : 'ltr';
  
  const detectRTL = (text: string): boolean => {
    return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
  };

  const setRTL = (rtl: boolean) => {
    setIsRTL(rtl);
    document.documentElement.dir = rtl ? 'rtl' : 'ltr';
    document.documentElement.lang = rtl ? 'ar' : 'en';
  };

  const value: RTLContextType = {
    isRTL,
    direction,
    setRTL,
    detectRTL,
  };

  return (
    <RTLContext.Provider value={value}>
      {props.children}
    </RTLContext.Provider>
  );
}

export function useRTL() {
  const context = useContext(RTLContext);
  if (!context) {
    throw new Error('useRTL must be used within RTLProvider');
  }
  return context;
}
```

### **4.2 RTL-Aware Components**

```typescript
// apps/papra-client/src/modules/documents/components/document-viewer.tsx
import { useRTL } from '../../layout/rtl.provider';

export function DocumentViewer(props: { document: Document }) {
  const { isRTL, direction } = useRTL();
  
  // Auto-detect RTL based on document content
  createEffect(() => {
    if (props.document.content) {
      const hasArabic = /[\u0600-\u06FF]/.test(props.document.content);
      if (hasArabic && !isRTL()) {
        // Auto-switch to RTL for Arabic documents
      }
    }
  });

  return (
    <div 
      class="document-viewer"
      dir={direction()}
      classList={{ 'rtl': isRTL() }}
    >
      <div class="document-header">
        <h1 class="document-title">{props.document.name}</h1>
      </div>
      
      <div class="document-content">
        <pre class="content-text" lang={isRTL() ? 'ar' : 'en'}>
          {props.document.content}
        </pre>
      </div>
    </div>
  );
}
```

### **4.3 RTL CSS Styles**

```css
/* apps/papra-client/src/modules/documents/components/document-viewer.css */
.document-viewer.rtl {
  direction: rtl;
  text-align: right;
}

.document-viewer.rtl .document-header {
  text-align: right;
}

.document-viewer.rtl .content-text {
  font-family: 'Noto Sans Arabic', 'Arial', sans-serif;
  line-height: 1.8;
  text-align: right;
  direction: rtl;
}

/* RTL Form Elements */
.rtl input,
.rtl textarea,
.rtl select {
  text-align: right;
  direction: rtl;
}

/* RTL Navigation */
.rtl .sidebar {
  right: 0;
  left: auto;
}

.rtl .main-content {
  margin-right: 250px;
  margin-left: 0;
}

/* Arabic Typography */
.arabic-text {
  font-family: 'Noto Sans Arabic', 'Arial', sans-serif;
  line-height: 1.8;
  font-size: 16px;
}
```

---

## Phase 5: Arabic Language Interface

### **5.1 Arabic Locale Configuration**

```typescript
// apps/papra-client/src/modules/i18n/i18n.constants.ts
export const locales = [
  { key: 'en', name: 'English' },
  { key: 'ar', name: 'العربية' }, // Add Arabic
  { key: 'fr', name: 'Français' },
  // ... other locales
] as const;

export type LocaleKey = typeof locales[number]['key'];
```

### **5.2 Arabic Translations**

```typescript
// apps/papra-client/src/modules/i18n/locales/ar.ts
export const ar = {
  common: {
    save: 'حفظ',
    cancel: 'إلغاء',
    delete: 'حذف',
    edit: 'تعديل',
    search: 'بحث',
    loading: 'جاري التحميل...',
    error: 'خطأ',
    success: 'تم بنجاح',
  },
  documents: {
    title: 'المستندات',
    upload: 'رفع مستند',
    search: 'البحث في المستندات',
    noDocuments: 'لا توجد مستندات',
    uploadNew: 'رفع مستند جديد',
    documentName: 'اسم المستند',
    documentType: 'نوع المستند',
    uploadDate: 'تاريخ الرفع',
    fileSize: 'حجم الملف',
  },
  navigation: {
    dashboard: 'لوحة التحكم',
    documents: 'المستندات',
    tags: 'العلامات',
    settings: 'الإعدادات',
    profile: 'الملف الشخصي',
  },
} as const;
```

---

## Phase 6: Testing & Validation

### **6.1 Arabic OCR Testing**

```typescript
// apps/papra-server/src/modules/documents/arabic/arabic-ocr.test.ts
import { describe, test, expect } from 'vitest';
import { ArabicTextProcessor } from './arabic-text-processor';

describe('Arabic OCR Processing', () => {
  test('should normalize Arabic text correctly', async () => {
    const processor = new ArabicTextProcessor();
    
    const input = 'أَهْلاً وَسَهْلاً بِكُمْ فِي نِظَامِ إِدَارَةِ الْمُسْتَندَاتِ';
    const expected = 'أهلاً وسهلاً بكم في نظام إدارة المستندات';
    
    const result = await processor.normalizeText(input);
    expect(result).toBe(expected);
  });

  test('should extract Arabic dates', async () => {
    const processor = new ArabicTextProcessor();
    
    const text = 'تم إنشاء هذا المستند في 15 يناير 2024';
    const dates = await processor.extractArabicDates(text);
    
    expect(dates).toHaveLength(1);
    expect(dates[0]).toEqual(new Date(2024, 0, 15));
  });
});
```

### **6.2 Arabic Search Testing**

```typescript
// apps/papra-server/src/modules/documents/arabic/arabic-search.test.ts
describe('Arabic Search Functionality', () => {
  test('should search Arabic text correctly', async () => {
    const repository = createDocumentsRepository({ db: testDb });
    
    // Insert test Arabic document
    await insertTestArabicDocument(testDb);
    
    const results = await repository.searchOrganizationDocuments({
      organizationId: 'test-org',
      searchQuery: 'فاتورة',
      pageIndex: 0,
      pageSize: 10,
      searchOptions: { enableArabicSearch: true }
    });
    
    expect(results.documents).toHaveLength(1);
    expect(results.documents[0].content).toContain('فاتورة');
  });
});
```

---

## Deployment & Configuration

### **Docker Configuration**

```dockerfile
# docker/Dockerfile
FROM node:22-slim AS base

# Install Arabic fonts and language support
RUN apt-get update && apt-get install -y \
    fonts-arabic \
    fonts-noto-sans-arabic \
    locales \
    && rm -rf /var/lib/apt/lists/*

# Generate Arabic locale
RUN locale-gen ar_SA.UTF-8
ENV LANG ar_SA.UTF-8
ENV LC_ALL ar_SA.UTF-8

# ... rest of Dockerfile
```

### **Environment Variables**

```bash
# .env
# Arabic OCR Configuration
DOCUMENTS_OCR_LANGUAGES=ara,eng
DOCUMENTS_ARABIC_OCR='{"enableRtlDetection":true,"enableArabicNormalization":true,"confidenceThreshold":70}'

# Database Configuration
DATABASE_ENCODING=utf8
DATABASE_COLLATION=ar_SA.UTF-8

# Frontend Configuration
CLIENT_DEFAULT_LOCALE=ar
CLIENT_SUPPORTED_LOCALES=en,ar,fr
```

---

## Performance Optimization

### **Arabic OCR Performance Monitor**

```typescript
// Arabic OCR Performance Monitor
class ArabicOCRMonitor {
  private metrics = {
    processingTime: [] as number[],
    accuracyScores: [] as number[],
    errorRates: [] as number[],
  };

  logProcessingTime(time: number) {
    this.metrics.processingTime.push(time);
  }

  logAccuracyScore(score: number) {
    this.metrics.accuracyScores.push(score);
  }

  getPerformanceReport() {
    const avgProcessingTime = this.metrics.processingTime.reduce((a, b) => a + b, 0) / this.metrics.processingTime.length;
    const avgAccuracy = this.metrics.accuracyScores.reduce((a, b) => a + b, 0) / this.metrics.accuracyScores.length;

    return {
      averageProcessingTime: avgProcessingTime,
      averageAccuracy: avgAccuracy,
      totalDocumentsProcessed: this.metrics.processingTime.length,
    };
  }
}
```

### **Database Optimization**

```sql
-- PostgreSQL performance tuning for Arabic text
-- Create indexes for Arabic text search
CREATE INDEX idx_documents_content_arabic ON documents USING gin(to_tsvector('arabic', content));
CREATE INDEX idx_documents_title_arabic ON documents USING gin(to_tsvector('arabic', title));

-- Optimize text search
CREATE TEXT SEARCH CONFIGURATION arabic (COPY = simple);
ALTER TEXT SEARCH CONFIGURATION arabic ALTER MAPPING FOR asciiword, asciihword, hword_asciipart, word, hword, hword_part WITH simple;

-- Vacuum and analyze
VACUUM ANALYZE documents;
```

---

## Troubleshooting

### **Common Issues & Solutions**

#### **OCR Quality Issues**
```typescript
// OCR Quality Improvement
function improveOCRQuality(imagePath: string): Buffer {
  const sharp = require('sharp');
  
  // Load and enhance image
  return sharp(imagePath)
    .grayscale()
    .sharpen()
    .normalize()
    .png()
    .toBuffer();
}
```

#### **Search Performance Issues**
```typescript
// Search Performance Optimization
class ArabicSearchOptimizer {
  private cache = new Map<string, any>();
  
  optimizeSearchIndex() {
    // Optimize FTS5 index
    // Force merge segments
    // Update index settings
  }
  
  implementSearchCaching(query: string, results: any[]) {
    const cacheKey = this.hashQuery(query);
    this.cache.set(cacheKey, {
      results,
      timestamp: Date.now(),
      ttl: 3600 // 1 hour cache
    });
  }
}
```

---

## Additional Resources

### **Useful Libraries**
- **Arabic Text Processing**: `arabic-reshaper`, `bidi`
- **OCR Enhancement**: `sharp`, `opencv4nodejs`
- **Search Optimization**: `sqlite3`, `better-sqlite3`
- **RTL Support**: `@solidjs/router`, `unocss`

### **Documentation Links**
- [Tesseract.js Documentation](https://tesseract.projectnaptha.com/)
- [SQLite FTS5](https://www.sqlite.org/fts5.html)
- [Arabic Unicode](https://unicode.org/charts/PDF/U0600.pdf)
- [RTL Layout Best Practices](https://www.w3.org/International/i18n-html-tech-lang)

### **Testing Resources**
- Arabic document samples
- OCR accuracy benchmarks
- Performance testing tools
- User acceptance testing scenarios

---

## Conclusion

This implementation guide provides a comprehensive approach to adding Arabic document processing support to Papra. The key benefits include:

1. **Enhanced OCR**: Arabic language support with Tesseract.js
2. **Text Processing**: Arabic text normalization and preprocessing
3. **Smart Search**: Arabic-aware full-text search with FTS5
4. **RTL Support**: Right-to-left layout and typography
5. **Arabic UI**: Localized Arabic interface
6. **Performance**: Optimized Arabic OCR processing

Follow the phased implementation approach for the best results, and ensure thorough testing at each stage. The modular architecture makes it easy to implement and maintain Arabic language support while preserving the existing system's performance and reliability.

---

## Implementation Checklist

### **Week 1-2: Foundation & OCR Enhancement**
- [ ] Update documents configuration with Arabic OCR settings
- [ ] Enhance OCR service with Arabic text detection
- [ ] Test Arabic OCR with sample documents
- [ ] Configure Tesseract.js for Arabic optimization

### **Week 2-3: Arabic Text Processing Pipeline**
- [ ] Create ArabicTextProcessor class
- [ ] Implement ArabicTextNormalizer
- [ ] Add ArabicDateExtractor
- [ ] Create ArabicNumberExtractor
- [ ] Test text processing pipeline

### **Week 3-4: Enhanced Search & Indexing**
- [ ] Create Arabic-aware FTS5 tables
- [ ] Enhance search repository with Arabic support
- [ ] Implement Arabic search query processing
- [ ] Test Arabic search functionality

### **Week 4-5: Frontend RTL Support**
- [ ] Create RTL provider and context
- [ ] Implement RTL-aware components
- [ ] Add RTL CSS styles
- [ ] Test RTL layout functionality

### **Week 5-6: Arabic Language Interface**
- [ ] Add Arabic locale configuration
- [ ] Create Arabic translations
- [ ] Implement locale switching
- [ ] Test Arabic interface

### **Week 6: Testing & Validation**
- [ ] Run comprehensive Arabic OCR tests
- [ ] Validate Arabic search functionality
- [ ] Test RTL layout and typography
- [ ] Performance testing and optimization
- [ ] User acceptance testing

---

## Support & Maintenance

### **Ongoing Tasks**
- Monitor Arabic OCR accuracy
- Optimize search performance
- Update Arabic translations
- Maintain RTL layout compatibility
- Performance monitoring and tuning

### **Future Enhancements**
- Advanced Arabic NLP features
- Machine learning for Arabic document classification
- Arabic handwriting recognition
- Arabic document templates
- Arabic-specific document types

This guide provides everything you need to implement comprehensive Arabic document processing support in Papra. Follow the phased approach, test thoroughly at each stage, and you'll have a robust, production-ready Arabic language system.