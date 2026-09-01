import { db } from '../db.js';
import { hashPassword, verifyPassword } from '../utils/password.js';

function sanitizeUser(user) {
  if (!user) return user;
  const sanitized = { ...user };
  delete sanitized.password;
  return sanitized;
}

import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_for_local_dev_only_998877';

function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.username, role: user.role, shopId: user.shopId },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export async function login(req, res, next) {
  const { username, password, role, name } = req.body;
  try {
    if (role === 'guest') {
      let user = await db.get('SELECT * FROM users WHERE LOWER(username) = LOWER(?) AND role = ?', [username, 'guest']);
      if (!user) {
        await db.run(
          'INSERT INTO users (username, name, password, role, shopId) VALUES (?, ?, ?, ?, ?)',
          [username.trim().toLowerCase(), (name || `Guest ${username}`).trim(), '', 'guest', null]
        );
        user = await db.get('SELECT * FROM users WHERE LOWER(username) = LOWER(?) AND role = ?', [username, 'guest']);
      }
      return res.json({ success: true, user: sanitizeUser(user), token: generateToken(user) });
    }

    if (role === 'student') {
      const cleanUsername = username.trim().toLowerCase();
      const user = await db.get('SELECT * FROM users WHERE LOWER(username) = ?', [cleanUsername]);
      
      if (!user) {
        return res.status(401).json({ success: false, message: 'Invalid credentials.' });
      }

      if (password && password.trim() !== '') {
        const isValid = await verifyPassword(password.trim(), user.password);
        if (!isValid) {
          return res.status(401).json({ success: false, message: 'Invalid credentials.' });
        }
      }

      return res.json({ success: true, user: sanitizeUser(user), token: generateToken(user) });
    }

    if (role === 'owner') {
      let user = await db.get('SELECT * FROM users WHERE username = ? AND role = ?', [username, 'owner']);
      if (!user) {
        return res.status(401).json({ success: false, message: 'Invalid credentials. Owner accounts must be created by an administrator.' });
      }
      const isValid = await verifyPassword(password, user.password);
      if (!isValid) {
        return res.status(401).json({ success: false, message: 'Invalid credentials.' });
      }
      return res.json({ success: true, user: sanitizeUser(user), token: generateToken(user) });
    }

    if (!role || role === 'admin') {
      const user = await db.get(
        'SELECT * FROM users WHERE LOWER(username) = LOWER(?)',
        [username]
      );
      if (!user) {
        return res.status(401).json({ success: false, message: 'Invalid credentials.' });
      }
      const isValid = await verifyPassword(password, user.password);
      if (!isValid) {
        return res.status(401).json({ success: false, message: 'Invalid credentials.' });
      }
      return res.json({ success: true, user: sanitizeUser(user), token: generateToken(user) });
    }

    const user = await db.get(
      'SELECT * FROM users WHERE LOWER(username) = LOWER(?) AND role = ?',
      [username, role]
    );

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }
    const isValidPwd = await verifyPassword(password, user.password);
    if (!isValidPwd) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }
    res.json({ success: true, user: sanitizeUser(user), token: generateToken(user) });
  } catch (err) {
    next(err);
  }
}

export async function loginGoogle(req, res, next) {
  const { email, name } = req.body;
  try {
    const cleanId = (email || '').trim().toLowerCase();
    let user = await db.get('SELECT * FROM users WHERE LOWER(username) = ?', [cleanId]);
    
    if (!user) {
      const displayName = name || (cleanId ? cleanId.split('@')[0] : 'Google Student');
      await db.run(
        'INSERT INTO users (username, name, password, role, shopId) VALUES (?, ?, ?, ?, ?)',
        [cleanId, displayName, '', 'student', null]
      );
      user = await db.get('SELECT * FROM users WHERE LOWER(username) = ?', [cleanId]);
    }

    const token = jwt.sign(
      { id: user.id, email: user.username, role: user.role, shopId: user.shopId },
      JWT_SECRET,
      { expiresIn: '30d' }
    );
    res.json({ success: true, user: sanitizeUser(user), token });
  } catch (err) {
    next(err);
  }
}

export async function register(req, res, next) {
  const { username, name, password, role } = req.validatedBody;
  const allowedRoles = ['student', 'guest'];
  const userRole = allowedRoles.includes(role) ? role : 'student';
  try {
    const existing = await db.get('SELECT * FROM users WHERE LOWER(username) = LOWER(?)', [username]);
    if (existing) {
      return res.status(409).json({ success: false, message: 'An account with this email or mobile already exists.' });
    }
    const hashedPwd = await hashPassword(password.trim());
    await db.run(
      'INSERT INTO users (username, name, password, role, shopId) VALUES (?, ?, ?, ?, ?)',
      [username.trim(), name.trim(), hashedPwd, userRole, null]
    );
    const user = await db.get('SELECT * FROM users WHERE LOWER(username) = LOWER(?)', [username]);
    const token = jwt.sign(
      { id: user.id, email: user.username, role: user.role, shopId: user.shopId },
      JWT_SECRET,
      { expiresIn: '30d' }
    );
    res.json({ success: true, user: sanitizeUser(user), token });
  } catch (err) {
    next(err);
  }
}

export async function verifyRegistration(req, res, next) {
  const { identifier } = req.body;
  if (!identifier) {
    return res.status(400).json({ success: false, message: 'Identifier is required.' });
  }
  try {
    const cleanId = identifier.trim().toLowerCase();
    const rawDigits = cleanId.replace(/\D/g, '');
    let user = await db.get('SELECT * FROM users WHERE LOWER(username) = ?', [cleanId]);
    if (!user && rawDigits.length >= 10) {
      user = await db.get('SELECT * FROM users WHERE username LIKE ?', [`%${rawDigits.slice(-10)}%`]);
    }

    if (!user) {
      return res.status(404).json({
        registered: false,
        message: 'Account not registered. This email or mobile number was never registered. Please check for typos or click Sign Up to create an account.'
      });
    }

    res.json({
      registered: true,
      user: sanitizeUser(user),
      message: 'Account verified successfully.'
    });
  } catch (err) {
    next(err);
  }
}

export async function getMe(req, res, next) {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    const user = await db.get('SELECT * FROM users WHERE LOWER(username) = LOWER(?)', [req.user.email]);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, user: sanitizeUser(user) });
  } catch (err) {
    next(err);
  }
}
