import { createClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://hmdewtmtxgfyunyypcon.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhtZGV3dG10eGdmeXVueXlwY29uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0MDQ2NDQsImV4cCI6MjA5NTk4MDY0NH0.sy6oeke8atqEHPnkWKMZPK9ggbJp8J3HF6G-GFsJRGg';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  console.warn('Supabase Notice: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY not set in build environment. Using default project connection.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

