// Server-side only. Uses the service-role key, which bypasses Row Level
// Security entirely — this file must NEVER be imported by anything that
// ships to the browser. Every API route is responsible for checking the
// caller's edit_token itself before calling anything mutating here.

const { createClient } = require('@supabase/supabase-js');

let client = null;

function supabaseAdmin() {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables. ' +
      'Set them in Vercel → Project → Settings → Environment Variables.'
    );
  }

  client = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return client;
}

module.exports = { supabaseAdmin };
