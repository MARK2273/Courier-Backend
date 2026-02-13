import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  // Warn instead of throw to allow build/test without env, but runtime will fail
  console.warn('Supabase URL or Key missing in environment variables.');
}

// @ts-ignore - Supabase client will throw if url is missing, but we handle it gracefully above
export const supabase = createClient(supabaseUrl || '', supabaseKey || '');
