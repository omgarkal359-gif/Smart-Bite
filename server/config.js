import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize dotenv in development
if (!process.env.VERCEL) {
  dotenv.config({ path: join(__dirname, '../.env') });
}

const NODE_ENV = process.env.NODE_ENV || 'development';
const VERCEL = !!process.env.VERCEL;
const DATABASE_URL = process.env.DATABASE_URL || '';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://hmdewtmtxgfyunyypcon.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
const SMTP_USER = process.env.SMTP_USER || process.env.EMAIL_USER || 'smartbite.sgu@gmail.com';
const SMTP_PASS = process.env.SMTP_PASS || process.env.EMAIL_PASS || '';
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT, 10) || 465;
const SMTP_SECURE = process.env.SMTP_SECURE !== 'false';
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS || '';
const BCRYPT_SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 12;
const JWT_SECRET = process.env.JWT_SECRET || 'smartbite_enterprise_jwt_secret_sgu_2026_prod_secure';
const PAYMENT_PROVIDER = process.env.PAYMENT_PROVIDER || 'mock';
const PLATFORM_COMMISSION_PERCENT = parseFloat(process.env.PLATFORM_COMMISSION_PERCENT) || 10;
const RECONCILE_TOKEN = process.env.RECONCILE_TOKEN || 'sgu_reconcile_secret_token_2026';

export const config = {
  NODE_ENV,
  VERCEL,
  DATABASE_URL,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_ANON_KEY,
  SMTP_USER,
  SMTP_PASS,
  SMTP_HOST,
  SMTP_PORT,
  SMTP_SECURE,
  ALLOWED_ORIGINS,
  BCRYPT_SALT_ROUNDS,
  JWT_SECRET,
  PAYMENT_PROVIDER,
  PLATFORM_COMMISSION_PERCENT,
  RECONCILE_TOKEN
};

// Soft warnings in production for environment configuration
if (config.NODE_ENV === 'production' && !process.env.VERCEL) {
  if (!config.DATABASE_URL) {
    console.warn('Production Configuration Warning: DATABASE_URL environment variable is missing.');
  }
}


export default config;

