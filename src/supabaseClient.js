import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://hmdewtmtxgfyunyypcon.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhtZGV3dG10eGdmeXVueXlwY29uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0MDQ2NDQsImV4cCI6MjA5NTk4MDY0NH0.sy6oeke8atqEHPnkWKMZPK9ggbJp8J3HF6G-GFsJRGg';

if (!supabaseAnonKey || supabaseAnonKey === 'YOUR_SUPABASE_ANON_KEY') {
  console.warn('WARNING: VITE_SUPABASE_ANON_KEY is not configured yet in your root .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
