import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL2!;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY2!;

export const supabase = createClient(supabaseUrl, supabaseKey);