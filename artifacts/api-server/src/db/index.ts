import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.js';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool, { schema });

export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS bot_users (
      id SERIAL PRIMARY KEY,
      telegram_id TEXT UNIQUE NOT NULL,
      username TEXT,
      first_name TEXT,
      last_name TEXT,
      language TEXT DEFAULT 'uz',
      is_subscribed BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS legal_documents (
      id SERIAL PRIMARY KEY,
      title_uz TEXT NOT NULL,
      title_ru TEXT NOT NULL,
      title_en TEXT NOT NULL,
      file_id TEXT NOT NULL,
      file_type TEXT DEFAULT 'document',
      category TEXT NOT NULL,
      doc_type TEXT NOT NULL DEFAULT 'sample',
      code TEXT UNIQUE,
      price REAL DEFAULT 0,
      is_paid BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS ads (
      id SERIAL PRIMARY KEY,
      user_id INTEGER,
      telegram_id TEXT NOT NULL,
      ad_type TEXT NOT NULL,
      field TEXT NOT NULL,
      region TEXT NOT NULL,
      experience TEXT,
      price TEXT,
      description TEXT NOT NULL,
      contact TEXT NOT NULL,
      message_id INTEGER,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS service_requests (
      id SERIAL PRIMARY KEY,
      telegram_id TEXT NOT NULL,
      first_name TEXT,
      service_type TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      assigned_account TEXT,
      admin_comment TEXT,
      message_id INTEGER,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS payment_cards (
      id SERIAL PRIMARY KEY,
      owner_name TEXT NOT NULL,
      card_number TEXT NOT NULL,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS payment_screenshots (
      id SERIAL PRIMARY KEY,
      telegram_id TEXT NOT NULL,
      document_code TEXT NOT NULL,
      file_id TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
  console.log('✅ DB tables initialized');
}

export { pool };
