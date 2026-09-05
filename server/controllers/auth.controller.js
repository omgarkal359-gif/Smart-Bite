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

async function syncUserToSupabaseAuth(username, name, password, role) {
  if (!supabase) return;
  try {
    const userEmail = (username && username.includes('@')) ? username.toLowerCase() : `${(username || 'user').toLowerCase()}@sgu.edu`;
    const displayName = name || userEmail.split('@')[0];

    const listRes = await supabase.auth.admin.listUsers().catch(() => ({ data: null }));
    const existingUser = listRes?.data?.users?.find(u => u.email?.toLowerCase() === userEmail.toLowerCase());

    if (!existingUser) {
      await supabase.auth.admin.createUser({
        email: userEmail,
        password: password || 'DefaultPass123!',
        email_confirm: true,
        user_metadata: { full_name: displayName, display_name: displayName, role: role || 'student' }
      }).catch(e => console.warn('Supabase createUser notice:', e.message));
    } else {
      await supabase.auth.admin.updateUserById(existingUser.id, {
        user_metadata: { ...existingUser.user_metadata, full_name: displayName, display_name: displayName, role: role || 'student' }
      }).catch(e => console.warn('Supabase updateUser notice:', e.message));
    }
  } catch (err) {
    console.warn('Supabase Auth user sync notice:', err.message);
  }
}

export async function login(req, res, next) {
  const { username, password, role, name } = req.body;
  try {
    if (!username || typeof username !== 'string' || !username.trim()) {
      return res.status(400).json({ success: false, message: 'Username is required.' });
    }

    const cleanUsername = username.trim();

    if (role === 'guest') {
      let user = await db.get('SELECT * FROM users WHERE LOWER(username) = LOWER(?) AND role = ?', [cleanUsername, 'guest']);
      if (!user) {
        await db.run(
          'INSERT INTO users (username, name, password, role, shopId) VALUES (?, ?, ?, ?, ?)',
          [cleanUsername.toLowerCase(), (name || `Guest ${cleanUsername}`).trim(), '', 'guest', null]
        );
        user = await db.get('SELECT * FROM users WHERE LOWER(username) = LOWER(?) AND role = ?', [cleanUsername, 'guest']);
      }
      syncUserToSupabaseAuth(cleanUsername, user.name, null, 'guest');
      const token = issueToken(user);
      return res.json({ success: true, user: sanitizeUser(user), token });
    }

    // Auto-detect user in database by username or shopId
    let user = await db.get(
      'SELECT * FROM users WHERE LOWER(username) = LOWER(?) OR (LOWER(shopId) = LOWER(?) AND role = ?)',
      [cleanUsername, cleanUsername, 'owner']
    );

    if (user) {
      if (!password || password.trim() === '') {
        return res.status(400).json({ success: false, message: 'Password is required.' });
      }

      const isValid = await verifyPassword(password.trim(), user.password);
      if (!isValid) {
        return res.status(401).json({ success: false, message: 'Invalid credentials.' });
      }

      syncUserToSupabaseAuth(user.username, user.name, password.trim(), user.role);
      const token = issueToken(user);
      return res.json({ success: true, user: sanitizeUser(user), token });
    }

    return res.status(401).json({ success: false, message: 'Invalid credentials.' });
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

    const ADMIN_EMAILS = ['omgarkal359@gmail.com', 'omgarkal357@gmail.com', 'admin@sgu.edu', 'admin@sguk.ac.in', 'admin@sgu.ac.in'];
    const assignedRole = ADMIN_EMAILS.includes(cleanId) ? 'admin' : 'student';

    let user = await db.get('SELECT * FROM users WHERE LOWER(username) = ?', [cleanId]);
    
    if (!user) {
      await db.run(
        'INSERT INTO users (username, name, password, role, shopId) VALUES (?, ?, ?, ?, ?)',
        [cleanId, displayName, '', assignedRole, null]
      );
      user = await db.get('SELECT * FROM users WHERE LOWER(username) = ?', [cleanId]);
    } else if (ADMIN_EMAILS.includes(cleanId) && user.role !== 'admin') {
      await db.run('UPDATE users SET role = ? WHERE LOWER(username) = ?', ['admin', cleanId]);
      user.role = 'admin';
    }

    syncUserToSupabaseAuth(cleanId, displayName, null, user.role);
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
    const token = issueToken(user);
    syncUserToSupabaseAuth(username.trim(), name.trim(), password.trim(), userRole);
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
    if (!req.user) return res.status(401).json({ success: false, message: 'Authentication required.' });
    const user = await db.get('SELECT * FROM users WHERE LOWER(username) = LOWER(?)', [req.user.email || req.user.id]);
    res.json({ success: true, user: sanitizeUser(user || req.user) });
  } catch (err) {
    next(err);
  }
}

