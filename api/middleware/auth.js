import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_for_local_dev_only_998877';

/**
 * Middleware that verifies the Supabase JWT or local JWT from the Authorization header.
 * Sets req.user = { id, email, role } on success.
 */
export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }

  const token = authHeader.split(' ')[1];

  // Try verifying local JWT first
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = {
      id: payload.id,
      email: payload.email,
      role: payload.role
    };
    return next();
  } catch (err) {
    // Local verification failed, let's try Supabase next
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(401).json({ success: false, message: 'Invalid token.' });
  }

  // Verify with Supabase
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  supabase.auth.getUser(token)
    .then(({ data, error }) => {
      if (error || !data?.user) {
        return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
      }
      req.user = {
        id: data.user.id,
        email: data.user.email,
        role: data.user.user_metadata?.role || data.user.app_metadata?.role || 'student'
      };
      next();
    })
    .catch(() => {
      return res.status(401).json({ success: false, message: 'Authentication failed.' });
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
