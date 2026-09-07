import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://hmdewtmtxgfyunyypcon.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseAnonKey) {
  console.warn('Supabase Warning: VITE_SUPABASE_ANON_KEY environment variable is missing.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey || 'placeholder-anon-key');
