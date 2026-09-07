import crypto from 'crypto';
import { config } from '../config.js';

// AES-256-GCM encryption for bank account numbers at rest.
// Key derived (sha256) from PAYOUT_ENCRYPTION_KEY so any-length secret works.
const KEY = config.PAYOUT_ENCRYPTION_KEY
  ? crypto.createHash('sha256').update(String(config.PAYOUT_ENCRYPTION_KEY)).digest()
  : null;

export const payoutCryptoReady = () => !!KEY;

export function encrypt(plain) {
  if (!KEY) throw new Error('PAYOUT_ENCRYPTION_KEY is not configured.');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // iv:tag:ciphertext (all base64)
  return `${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}

export function decrypt(payload) {
  if (!KEY) throw new Error('PAYOUT_ENCRYPTION_KEY is not configured.');
  const [ivB64, tagB64, encB64] = String(payload).split(':');
  const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(encB64, 'base64')), decipher.final()]).toString('utf8');
}

export const last4 = (s) => String(s || '').replace(/\s/g, '').slice(-4);
