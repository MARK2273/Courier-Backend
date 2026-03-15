import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  // Warn instead of throw to allow build/test without env, but runtime will fail
  console.warn('Supabase URL or Key missing in environment variables.');
}

// Regular client
// @ts-ignore
export const supabase = createClient(supabaseUrl || '', supabaseKey || '');

// Admin client for storage/background tasks
// @ts-ignore
export const supabaseAdmin = createClient(supabaseUrl || '', supabaseServiceKey || supabaseKey || '');
