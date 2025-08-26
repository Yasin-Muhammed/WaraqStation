import type { Migration } from '../migrations.types';
import { sql } from 'drizzle-orm';

export const arabicFtsEnhancementMigration = {
  name: 'arabic-fts-enhancement',

  up: async ({ db }) => {
    // Create a function to normalize Arabic text for FTS indexing
    await db.run(sql`
      CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts_arabic USING fts5(
        id UNINDEXED, 
        name, 
        original_name, 
        content,
        content_normalized,
        tokenize = 'unicode61 remove_diacritics 1'
      )
    `);
    
    // Create a trigger to populate the Arabic-enhanced FTS table
    await db.run(sql`
      CREATE TRIGGER IF NOT EXISTS trigger_documents_fts_arabic_insert AFTER INSERT ON documents BEGIN
        INSERT INTO documents_fts_arabic(id, name, original_name, content, content_normalized) 
        VALUES (
          new.id, 
          new.name, 
          new.original_name, 
          new.content,
          -- Normalize Arabic text by removing diacritics and standardizing characters
          REPLACE(
            REPLACE(
              REPLACE(
                REPLACE(
                  REPLACE(
                    REPLACE(new.content, 'آ', 'ا'),
                    'أ', 'ا'
                  ),
                  'إ', 'ا'
                ),
                'ى', 'ي'
              ),
              'ة', 'ه'
            ),
            'ء', ''
          )
        );
      END
    `);
    
    await db.run(sql`
      CREATE TRIGGER IF NOT EXISTS trigger_documents_fts_arabic_update AFTER UPDATE ON documents BEGIN
        UPDATE documents_fts_arabic SET 
          name = new.name, 
          original_name = new.original_name, 
          content = new.content,
          content_normalized = REPLACE(
            REPLACE(
              REPLACE(
                REPLACE(
                  REPLACE(
                    REPLACE(new.content, 'آ', 'ا'),
                    'أ', 'ا'
                  ),
                  'إ', 'ا'
                ),
                'ى', 'ي'
              ),
              'ة', 'ه'
            ),
            'ء', ''
          )
        WHERE id = new.id;
      END
    `);
    
    await db.run(sql`
      CREATE TRIGGER IF NOT EXISTS trigger_documents_fts_arabic_delete AFTER DELETE ON documents BEGIN
        DELETE FROM documents_fts_arabic WHERE id = old.id;
      END
    `);
    
    // Populate the new FTS table with existing data
    await db.run(sql`
      INSERT INTO documents_fts_arabic(id, name, original_name, content, content_normalized)
      SELECT 
        id, 
        name, 
        original_name, 
        content,
        REPLACE(
          REPLACE(
            REPLACE(
              REPLACE(
                REPLACE(
                  REPLACE(content, 'آ', 'ا'),
                  'أ', 'ا'
                ),
                'إ', 'ا'
              ),
              'ى', 'ي'
            ),
            'ة', 'ه'
          ),
          'ء', ''
        )
      FROM documents 
      WHERE NOT EXISTS (
        SELECT 1 FROM documents_fts_arabic WHERE documents_fts_arabic.id = documents.id
      )
    `);
  },

  down: async ({ db }) => {
    await db.run(sql`DROP TRIGGER IF EXISTS trigger_documents_fts_arabic_insert`);
    await db.run(sql`DROP TRIGGER IF EXISTS trigger_documents_fts_arabic_update`);
    await db.run(sql`DROP TRIGGER IF EXISTS trigger_documents_fts_arabic_delete`);
    await db.run(sql`DROP TABLE IF EXISTS documents_fts_arabic`);
  },
} satisfies Migration;