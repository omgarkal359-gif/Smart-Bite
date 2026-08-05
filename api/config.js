import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize dotenv in development
if (!process.env.VERCEL) {
  dotenv.config({ path: join(__dirname, '../.env') });
}

export const config = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  VERCEL: !!process.env.VERCEL,
  
  // Database Configurations
  DATABASE_URL: process.env.DATABASE_URL || '',
  
  // Supabase Configurations
  SUPABASE_URL: process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://hmdewtmtxgfyunyypcon.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '',

  // SMTP Email Configurations
  SMTP_USER: process.env.SMTP_USER || process.env.EMAIL_USER || 'smartbite.sgu@gmail.com',
  SMTP_PASS: process.env.SMTP_PASS || process.env.EMAIL_PASS || '',
  SMTP_HOST: process.env.SMTP_HOST || 'smtp.gmail.com',
  SMTP_PORT: parseInt(process.env.SMTP_PORT, 10) || 465,
  SMTP_SECURE: process.env.SMTP_SECURE !== 'false',

  // Auth Constants
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || '',
  BCRYPT_SALT_ROUNDS: parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 12,
  JWT_SECRET: process.env.JWT_SECRET || 'fallback-super-secret-key-change-in-prod'
};

// Fail fast in production for critical environment settings
if (config.NODE_ENV === 'production') {
  if (!config.DATABASE_URL) {
    throw new Error('Production Configuration Error: DATABASE_URL environment variable is missing.');
  }
  if (!config.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Production Configuration Error: SUPABASE_SERVICE_ROLE_KEY environment variable is missing.');
  }
}

export default config;
