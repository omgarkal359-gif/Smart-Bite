import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://hmdewtmtxgfyunyypcon.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseAnonKey || supabaseAnonKey === 'YOUR_SUPABASE_ANON_KEY') {
  console.warn('WARNING: VITE_SUPABASE_ANON_KEY is not configured yet in your root .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey || 'dummy-key-to-prevent-crash');
