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
  // Support test environment ONLY for test suite headers with strict allowlist enforcement
  if (process.env.NODE_ENV === 'test') {
    if (req.headers['x-user-id'] || req.headers['x-user-role']) {
      const email = (req.headers['x-user-email'] || req.headers['x-user-id'] || 'test@sgu.edu').trim().toLowerCase();
      const rawRole = (req.headers['x-user-role'] || 'student').toLowerCase();
      const isAllowedAdmin = config.ADMIN_EMAILS.includes(email);
      const role = (rawRole === 'admin' && !isAllowedAdmin) ? 'student' : rawRole;

      req.user = {
        id: req.headers['x-user-id'] || 'test-user-id',
        email,
        role,
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
          const verifiedEmail = (data.user.email || '').trim().toLowerCase();
          const isAllowedAdmin = config.ADMIN_EMAILS.includes(verifiedEmail);
          const rawRole = (data.user.app_metadata?.role || data.user.user_metadata?.role || 'student').toLowerCase();
          
          let effectiveRole = rawRole;
          if (rawRole === 'admin' && !isAllowedAdmin) {
            effectiveRole = 'student';
          } else if (isAllowedAdmin && rawRole !== 'owner') {
            effectiveRole = 'admin';
          }

          req.user = {
            id: data.user.id,
            email: verifiedEmail,
            role: effectiveRole,
            shopId: data.user.app_metadata?.shopId || data.user.user_metadata?.shopId || null
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
    const verifiedEmail = (decoded.email || decoded.username || '').trim().toLowerCase();
    const isAllowedAdmin = config.ADMIN_EMAILS.includes(verifiedEmail);
    const rawRole = (decoded.role || 'student').toLowerCase();

    let effectiveRole = rawRole;
    if (rawRole === 'admin' && !isAllowedAdmin) {
      effectiveRole = 'student';
    } else if (isAllowedAdmin && rawRole !== 'owner') {
      effectiveRole = 'admin';
    }

    req.user = {
      id: decoded.sub || decoded.id || decoded.username,
      email: verifiedEmail,
      role: effectiveRole,
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

    const verifiedEmail = (req.user.email || '').trim().toLowerCase();
    const isAllowedAdmin = config.ADMIN_EMAILS.includes(verifiedEmail);

    if (roles.includes('admin')) {
      if (req.user.role !== 'admin' || !isAllowedAdmin) {
        return res.status(403).json({ 
          success: false, 
          message: 'Admin access denied: Email is not on the authorized admin allowlist.' 
        });
      }
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Insufficient permissions.' });
    }
    next();
  };
}
