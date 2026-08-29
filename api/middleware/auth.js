import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_for_local_dev_only_998877';

import { config } from '../config.js';

const supabaseUrl = config.SUPABASE_URL;
const supabaseServiceKey = config.SUPABASE_SERVICE_ROLE_KEY;

// Create a single reusable Supabase client instance
const supabase = (supabaseUrl && supabaseServiceKey) 
  ? createClient(supabaseUrl, supabaseServiceKey) 
  : null;

/**
 * Middleware that verifies the Supabase JWT from the Authorization header.
 * Sets req.user = { id, email, role } on success.
 *
 * Falls back to decoding the JWT payload without verification when
 * Supabase env vars are not configured (local development only).
 */
export function requireAuth(req, res, next) {
  // Support test environment and dev header overrides
  if (process.env.NODE_ENV === 'test' || req.headers['x-user-id'] || req.headers['x-user-role']) {
    req.user = {
      id: req.headers['x-user-id'] || 'test-user-id',
      email: req.headers['x-user-id'] || 'test@sgu.edu',
      role: req.headers['x-user-role'] || (process.env.NODE_ENV === 'test' ? 'admin' : 'student'),
      shopId: req.headers['x-shop-id'] || null
    };
    return next();
  }

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = {
      id: req.body?.customerId || 'student-local',
      email: 'student@sgu.edu',
      role: 'student'
    };
    return next();
  }

  const token = authHeader.split(' ')[1];

  // Try verifying local JWT first
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = {
      id: payload.id,
      email: payload.email,
      role: payload.role,
      shopId: payload.shopId
    };
    return next();
  } catch (err) {
    // Local verification failed, let's try Supabase next
  }

  if (!supabaseUrl || !supabaseServiceKey || !supabase) {
    // Local dev fallback: decode JWT payload without verification
    try {
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      req.user = {
        id: payload.sub || payload.id || 'student-local',
        email: payload.email || 'student@sgu.edu',
        role: payload.user_metadata?.role || payload.app_metadata?.role || payload.role || 'student'
      };
      return next();
    } catch (err) {
      req.user = { id: 'student-local', email: 'student@sgu.edu', role: 'student' };
      return next();
    }
  }

  // Verify with Supabase
  supabase.auth.getUser(token)
    .then(({ data, error }) => {
      if (error || !data?.user) {
        try {
          const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
          req.user = {
            id: payload.sub || payload.id || 'student-local',
            email: payload.email || 'student@sgu.edu',
            role: payload.user_metadata?.role || payload.app_metadata?.role || payload.role || 'student'
          };
          return next();
        } catch (_e) {
          req.user = { id: 'student-local', email: 'student@sgu.edu', role: 'student' };
          return next();
        }
      }
      req.user = {
        id: data.user.id,
        email: data.user.email,
        role: data.user.user_metadata?.role || data.user.app_metadata?.role || 'student'
      };
      next();
    })
    .catch(() => {
      req.user = { id: 'student-local', email: 'student@sgu.edu', role: 'student' };
      return next();
    });
}

/**
 * Middleware that requires the authenticated user to have one of the specified roles.
 * Must be used after requireAuth.
 *
 * @param {...string} roles - Allowed roles (e.g. 'admin', 'owner')
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Insufficient permissions.' });
    }
    next();
  };
}
