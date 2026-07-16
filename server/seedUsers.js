// One-time seed: run with `node server/seedUsers.js` after the `users`
// table exists (server/supabase-schema.sql) and SUPABASE_URL /
// SUPABASE_SERVICE_ROLE_KEY are set in server/.env. Safe to re-run --
// skips any account that already exists rather than overwriting it.
require('dotenv').config();
const auth = require('./auth');
const db = require('./db');

const SEED_USERS = [
  { email: 'alecg810@gmail.com', password: 'Alec', role: 'owner' },
  { email: 'fivemthing@gmail.com', password: 'Narciso', role: 'admin' }
];

async function seed() {
  const client = db.getClient();
  if (!client) {
    console.error('Supabase is not configured -- set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in server/.env first.');
    process.exit(1);
  }

  for (const u of SEED_USERS) {
    const existing = await auth.findUserByEmail(u.email);
    if (existing) {
      console.log('Skipping ' + u.email + ' -- account already exists.');
      continue;
    }
    const passwordHash = await auth.hashPassword(u.password);
    const { error } = await client.from('users').insert({
      email: u.email.toLowerCase(),
      password_hash: passwordHash,
      role: u.role,
      must_change_password: true
    });
    if (error) {
      console.error('Failed to seed ' + u.email + ': ' + error.message);
    } else {
      console.log('Seeded ' + u.email + ' (' + u.role + ') -- must_change_password=true');
    }
  }
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seeding failed:', err.message);
  process.exit(1);
});
