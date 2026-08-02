import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Middleware that verifies the Supabase JWT from the Authorization header.
 * Sets req.user = { id, email, role } on success.
 *
 * Falls back to decoding the JWT payload without verification when
 * Supabase env vars are not configured (local development only).
 */
export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }

  const token = authHeader.split(' ')[1];

  if (!supabaseUrl || !supabaseServiceKey) {
    // Local dev fallback: decode JWT payload without verification
    try {
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      req.user = {
        id: payload.sub || payload.id,
        email: payload.email,
        role: payload.user_metadata?.role || payload.app_metadata?.role || payload.role || 'student'
      };
      return next();
    } catch (err) {
      return res.status(401).json({ success: false, message: 'Invalid token.' });
    }
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
