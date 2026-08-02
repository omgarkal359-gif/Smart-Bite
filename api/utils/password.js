import bcrypt from 'bcrypt';

const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 12;

/**
 * Hash a plaintext password using bcrypt.
 * @param {string} plainPassword
 * @returns {Promise<string>} bcrypt hash
 */
export async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

/**
 * Verify a plaintext password against a stored hash.
 * Handles legacy plaintext passwords during migration — if the stored
 * password doesn't look like a bcrypt hash, compares literally.
 * @param {string} plainPassword
 * @param {string} storedPassword
 * @returns {Promise<boolean>}
 */
export async function verifyPassword(plainPassword, storedPassword) {
  if (!storedPassword) return false;

  // Legacy plaintext passwords: bcrypt hashes always start with $2b$ or $2a$
  if (!storedPassword.startsWith('$2b$') && !storedPassword.startsWith('$2a$')) {
    return plainPassword === storedPassword;
  }
  return bcrypt.compare(plainPassword, storedPassword);
}
