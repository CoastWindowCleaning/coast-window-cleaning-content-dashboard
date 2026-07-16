const { createClient } = require('@supabase/supabase-js');

let client = null;

function supabaseConfigured() {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

// Server-only client using the service role key -- this bypasses Row Level
// Security, which is fine here because Supabase is never talked to directly
// from the browser. All access goes through this Express server.
function getClient() {
  if (!supabaseConfigured()) return null;
  if (!client) {
    client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false }
    });
  }
  return client;
}

module.exports = { supabaseConfigured, getClient };
