import type { ConfigDefinition } from 'figue';
import { z } from 'zod';

export const databaseConfig = {
  url: {
    doc: 'The URL of the database (default as "file:./app-data/db/db.sqlite" when using docker)',
    schema: z.string().url(),
    default: 'file:./db.sqlite',
    env: 'DATABASE_URL',
  },
  authToken: {
    doc: 'The auth token for the database',
    schema: z.string().optional(),
    default: undefined,
    env: 'DATABASE_AUTH_TOKEN',
  },
  encryptionKey: {
    doc: 'The encryption key for the database. If not provided, the database will not be encrypted. Use with caution as if lost, the data will be unrecoverable.',
    schema: z.string().optional(),
    default: undefined,
    env: 'DATABASE_ENCRYPTION_KEY',
  },
  useEnhancedDriver: {
    doc: 'Use enhanced SQLite driver (better-sqlite3) for improved Arabic text processing performance. Only works with local SQLite files.',
    schema: z.boolean(),
    default: true,
    env: 'DATABASE_USE_ENHANCED_DRIVER',
  },
} as const satisfies ConfigDefinition;
