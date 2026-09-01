import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';
import { db } from '../db.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { config } from '../config.js';

const supabaseUrl = config.SUPABASE_URL;
const supabaseServiceKey = config.SUPABASE_SERVICE_ROLE_KEY;
const supabase = (supabaseUrl && supabaseServiceKey) ? createClient(supabaseUrl, supabaseServiceKey) : null;

function sanitizeUser(user) {
  if (!user) return user;
  const sanitized = { ...user };
  delete sanitized.password;
  return sanitized;
}

function issueToken(user) {
  const payload = {
    sub: user.id || user.username,
    username: user.username,
    email: user.username,
    role: user.role,
    shopId: user.shopId || null
  };
  return jwt.sign(payload, config.JWT_SECRET, { expiresIn: '7d' });
}

export async function login(req, res, next) {
  const { username, password, role, name } = req.body;
  try {
    if (!username || typeof username !== 'string' || !username.trim()) {
      return res.status(400).json({ success: false, message: 'Username is required.' });
    }

    if (role === 'guest') {
      let user = await db.get('SELECT * FROM users WHERE LOWER(username) = LOWER(?) AND role = ?', [username, 'guest']);
      if (!user) {
        await db.run(
          'INSERT INTO users (username, name, password, role, shopId) VALUES (?, ?, ?, ?, ?)',
          [username.trim().toLowerCase(), (name || `Guest ${username}`).trim(), '', 'guest', null]
        );
        user = await db.get('SELECT * FROM users WHERE LOWER(username) = LOWER(?) AND role = ?', [username, 'guest']);
      }
      const token = issueToken(user);
      return res.json({ success: true, user: sanitizeUser(user), token });
    }

    if (role === 'student') {
      const cleanUsername = username.trim().toLowerCase();
      const user = await db.get('SELECT * FROM users WHERE LOWER(username) = ?', [cleanUsername]);
      
      if (!user) {
        return res.status(401).json({ success: false, message: 'Invalid credentials.' });
      }

      if (!password || password.trim() === '') {
        return res.status(400).json({ success: false, message: 'Password is required for student login.' });
      }

      const isValid = await verifyPassword(password.trim(), user.password);
      if (!isValid) {
        return res.status(401).json({ success: false, message: 'Invalid credentials.' });
      }

      const token = issueToken(user);
      return res.json({ success: true, user: sanitizeUser(user), token });
    }

    if (role === 'owner') {
      let user = await db.get('SELECT * FROM users WHERE username = ? AND role = ?', [username, 'owner']);
      if (!user) {
        return res.status(401).json({ success: false, message: 'Invalid credentials. Owner accounts must be created by an administrator.' });
      }
      if (!password || password.trim() === '') {
        return res.status(400).json({ success: false, message: 'Password is required.' });
      }
      const isValid = await verifyPassword(password, user.password);
      if (!isValid) {
        return res.status(401).json({ success: false, message: 'Invalid credentials.' });
      }
      const token = issueToken(user);
      return res.json({ success: true, user: sanitizeUser(user), token });
    }

    if (!role || role === 'admin') {
      const user = await db.get(
        'SELECT * FROM users WHERE LOWER(username) = LOWER(?)',
        [username]
      );
      if (!user) {
        return res.status(401).json({ success: false, message: 'Invalid credentials.' });
      }
      if (!password || password.trim() === '') {
        return res.status(400).json({ success: false, message: 'Password is required.' });
      }
      const isValid = await verifyPassword(password, user.password);
      if (!isValid) {
        return res.status(401).json({ success: false, message: 'Invalid credentials.' });
      }
      const token = issueToken(user);
      return res.json({ success: true, user: sanitizeUser(user), token });
    }

    const user = await db.get(
      'SELECT * FROM users WHERE LOWER(username) = LOWER(?) AND role = ?',
      [username, role]
    );

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }
    if (!password || password.trim() === '') {
      return res.status(400).json({ success: false, message: 'Password is required.' });
    }
    const isValidPwd = await verifyPassword(password, user.password);
    if (!isValidPwd) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }
    const token = issueToken(user);
    res.json({ success: true, user: sanitizeUser(user), token });
  } catch (err) {
    next(err);
  }
}

export async function loginGoogle(req, res, next) {
  const { email, name, idToken } = req.body;
  const authHeader = req.headers.authorization;
  const token = (authHeader && authHeader.startsWith('Bearer ')) ? authHeader.split(' ')[1] : idToken;

  try {
    let cleanId = (email || '').trim().toLowerCase();
    let displayName = name || (cleanId ? cleanId.split('@')[0] : 'Google Student');

    if (supabase && token) {
      const { data, error } = await supabase.auth.getUser(token);
      if (error || !data?.user) {
        return res.status(401).json({ success: false, message: 'Invalid or unverified Google token.' });
      }
      cleanId = data.user.email.trim().toLowerCase();
      displayName = data.user.user_metadata?.full_name || data.user.user_metadata?.name || cleanId.split('@')[0];
    } else if (!cleanId) {
      return res.status(400).json({ success: false, message: 'Authentication token or email is required.' });
    }

    let user = await db.get('SELECT * FROM users WHERE LOWER(username) = ?', [cleanId]);
    
    if (!user) {
      await db.run(
        'INSERT INTO users (username, name, password, role, shopId) VALUES (?, ?, ?, ?, ?)',
        [cleanId, displayName, '', 'student', null]
      );
      user = await db.get('SELECT * FROM users WHERE LOWER(username) = ?', [cleanId]);
    }

    const appToken = issueToken(user);
    res.json({ success: true, user: sanitizeUser(user), token: appToken });
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
    res.json({ success: true, user: sanitizeUser(user) });
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
