import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize dotenv in development
if (!process.env.VERCEL) {
  dotenv.config({ path: join(__dirname, '../.env') });
}

// List of known insecure / compromised / default fallback JWT secrets
const KNOWN_INSECURE_SECRETS = [
  'smartbite_enterprise_jwt_secret_sgu_2026_prod_secure',
  'secret',
  'development-secret',
  'default-secret',
  '123456',
  'password',
  'change_me',
  'change_this_secret',
  'your_jwt_secret',
  'jwt_secret',
  'supersecret',
  'admin'
].map(s => s.toLowerCase());

export function validateJwtSecret(customSecret) {
  const rawSecret = arguments.length > 0 ? customSecret : process.env.JWT_SECRET;

  if (rawSecret === undefined || rawSecret === null || typeof rawSecret !== 'string' || !rawSecret.trim()) {
    console.error('================================================================');
    console.error('FATAL CONFIGURATION ERROR:');
    console.error('JWT_SECRET environment variable is missing or empty.');
    console.error('Application startup aborted to prevent insecure operation.');
    console.error('Please configure a strong JWT_SECRET in your environment file or deployment settings.');
    console.error('================================================================');
    if (process.env.NODE_ENV !== 'test' && !process.env.SUPPRESS_STARTUP_EXIT) {
      process.exit(1);
    }
    throw new Error('FATAL: JWT_SECRET environment variable is required.');
  }

  const trimmedSecret = rawSecret.trim();

  if (KNOWN_INSECURE_SECRETS.includes(trimmedSecret.toLowerCase())) {
    console.error('================================================================');
    console.error('FATAL CONFIGURATION ERROR:');
    console.error('JWT_SECRET is set to a known insecure or compromised fallback value.');
    console.error('Application startup aborted. Please set a unique, high-entropy JWT_SECRET.');
    console.error('================================================================');
    if (process.env.NODE_ENV !== 'test' && !process.env.SUPPRESS_STARTUP_EXIT) {
      process.exit(1);
    }
    throw new Error('FATAL: JWT_SECRET matches a known insecure secret.');
  }

  if (trimmedSecret.length < 32) {
    console.error('================================================================');
    console.error('FATAL CONFIGURATION ERROR:');
    console.error('JWT_SECRET does not meet the minimum entropy / length requirement (minimum 32 characters).');
    console.error('Application startup aborted. Please provide a secret with at least 32 characters.');
    console.error('================================================================');
    if (process.env.NODE_ENV !== 'test' && !process.env.SUPPRESS_STARTUP_EXIT) {
      process.exit(1);
    }
    throw new Error('FATAL: JWT_SECRET must be at least 32 characters long.');
  }

  return trimmedSecret;
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

// Fail-fast startup validation for JWT_SECRET
const JWT_SECRET = validateJwtSecret();

const PAYMENT_PROVIDER = process.env.PAYMENT_PROVIDER || 'mock';
const PLATFORM_COMMISSION_PERCENT = parseFloat(process.env.PLATFORM_COMMISSION_PERCENT) || 10;
const RECONCILE_TOKEN = process.env.RECONCILE_TOKEN || 'sgu_reconcile_secret_token_2026';

const ADMIN_EMAILS_RAW = process.env.ADMIN_EMAILS || 'omgarkal357@gmail.com,omgarkal359@gmail.com';
const ADMIN_EMAILS = ADMIN_EMAILS_RAW
  .split(',')
  .map(email => email.trim().toLowerCase())
  .filter(Boolean);

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
  RECONCILE_TOKEN,
  ADMIN_EMAILS
};

// Soft warnings in production for environment configuration
if (config.NODE_ENV === 'production' && !process.env.VERCEL) {
  if (!config.DATABASE_URL) {
    console.warn('Production Configuration Warning: DATABASE_URL environment variable is missing.');
  }
}

export default config;

