import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = (import.meta as any).env.VITE_SUPABASE_URL || 'https://ekhtfzpkyjrvewrhcbor.supabase.co';
const SUPABASE_ANON_KEY = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVraHRmenBreWpydmV3cmhjYm9yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMjM0ODUsImV4cCI6MjA5OTY5OTQ4NX0.qLeyzHMgnw1PkOek-XQgyTfWj_RHmVszV-nqY-A1FLQ';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Helper function to check if connection works and tables exist
export async function checkSupabaseConnection() {
  try {
    const { data, error } = await supabase.from('users').select('id').limit(1);
    if (error) {
      // If error is code PGRST116 or similar (relation doesn't exist), we know connection works but tables are missing
      if (error.code === 'PGRST116' || error.message.includes('does not exist')) {
        return { connected: true, tablesExist: false, error: error.message };
      }
      return { connected: false, tablesExist: false, error: error.message };
    }
    return { connected: true, tablesExist: true };
  } catch (err: any) {
    return { connected: false, tablesExist: false, error: err.message };
  }
}
