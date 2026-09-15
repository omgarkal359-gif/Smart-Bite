import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  console.error('Supabase Configuration Error: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variable is missing.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

