import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';

const supabaseUrl = config.SUPABASE_URL;
const supabaseServiceKey = config.SUPABASE_SERVICE_ROLE_KEY;

// Create a single reusable Supabase client instance
const supabase = (supabaseUrl && supabaseServiceKey) 
  ? createClient(supabaseUrl, supabaseServiceKey) 
  : null;

/**
 * Middleware that verifies authentication tokens (Supabase JWT or app JWT).
 * Sets req.user = { id, email, role, shopId } on success.
 *
 * FAILS CLOSED: Header overrides (x-user-id/x-user-role) are strictly restricted
 * to test mode (process.env.NODE_ENV === 'test').
 */
export function requireAuth(req, res, next) {
  // Support test environment ONLY (prevent production header spoofing)
  if (process.env.NODE_ENV === 'test') {
    if (req.headers['x-user-id'] || req.headers['x-user-role']) {
      req.user = {
        id: req.headers['x-user-id'] || 'test-user-id',
        email: req.headers['x-user-id'] || 'test@sgu.edu',
        role: req.headers['x-user-role'] || 'admin',
        shopId: req.headers['x-shop-id'] || null
      };
      return next();
    }
  }

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }

  const token = authHeader.split(' ')[1];

  // 1. If Supabase client is configured, verify with Supabase Auth first
  if (supabase) {
    supabase.auth.getUser(token)
      .then(({ data, error }) => {
        if (!error && data?.user) {
          req.user = {
            id: data.user.id,
            email: data.user.email,
            role: data.user.user_metadata?.role || data.user.app_metadata?.role || 'student',
            shopId: data.user.user_metadata?.shopId || data.user.app_metadata?.shopId || null
          };
          return next();
        }
        // Fall back to JWT secret verification
        verifyAppJwt(token, req, res, next);
      })
      .catch(() => {
        verifyAppJwt(token, req, res, next);
      });
  } else {
    // 2. Verify app-issued JWT with signature verification
    verifyAppJwt(token, req, res, next);
  }
}

function verifyAppJwt(token, req, res, next) {
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET);
    req.user = {
      id: decoded.sub || decoded.id || decoded.username,
      email: decoded.email || decoded.username,
      role: decoded.role || 'student',
      shopId: decoded.shopId || null
    };
    return next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired authentication token.' });
  }
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
