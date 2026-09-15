import { createClient } from '@supabase/supabase-js';

// Supabase connection is configured exclusively through build-time env vars.
// The anon key is public by design (it ships in the browser bundle), but the
// specific project URL/key must NOT be hard-coded in source — that pins the
// repo to one project and blocks rotation. Set these in .env (local) and in
// your host's environment (Vercel/Netlify/etc.):
//   VITE_SUPABASE_URL
//   VITE_SUPABASE_ANON_KEY
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Fail loudly instead of silently connecting to a baked-in fallback project.
  throw new Error(
    'Supabase config missing: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY ' +
    'in your environment (.env for local dev, project settings for deploys).'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
