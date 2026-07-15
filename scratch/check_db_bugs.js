import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://ekhtfzpkyjrvewrhcbor.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVraHRmenBreWpydmV3cmhjYm9yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMjM0ODUsImV4cCI6MjA5OTY5OTQ4NX0.qLeyzHMgnw1PkOek-XQgyTfWj_RHmVszV-nqY-A1FLQ';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const { data: bugs, error } = await supabase
    .from('bugs')
    .select('*')
    .order('timestamp', { ascending: false });

  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log("Bugs data in DB:");
  bugs.forEach((bug, index) => {
    console.log(`\n--- Bug ${index + 1} (ID: ${bug.id}) ---`);
    console.log("Description:", JSON.stringify(bug.description));
    console.log("Images count:", bug.image ? bug.image.length : 0);
  });
}

run();
