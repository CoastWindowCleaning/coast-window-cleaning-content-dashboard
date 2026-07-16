const fs = require('fs');
const path = require('path');
const db = require('./db');

const DATA_FILE = process.env.DATA_STORE_PATH || path.join(__dirname, 'data-store.json');
const ROW_ID = 'default';

function readFileStore() {
  try {
    if (!fs.existsSync(DATA_FILE)) return null;
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    if (!raw.trim()) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading local data store:', err.message);
    return null;
  }
}

function writeFileStore(obj) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(obj));
}

async function readDataStore() {
  const client = db.getClient();
  if (!client) return readFileStore();

  const { data, error } = await client
    .from('dashboard_state')
    .select('data')
    .eq('id', ROW_ID)
    .maybeSingle();

  if (error) {
    console.error('Supabase read error:', error.message);
    return null;
  }
  return data ? data.data : null;
}

async function writeDataStore(obj) {
  const client = db.getClient();
  if (!client) return writeFileStore(obj);

  const { error } = await client
    .from('dashboard_state')
    .upsert({ id: ROW_ID, data: obj, updated_at: new Date().toISOString() });

  if (error) throw new Error('Supabase write error: ' + error.message);
}

// One-time convenience: if Supabase is newly configured and has no row yet,
// but a local data-store.json from before the migration exists, seed Supabase
// with it so real logged reels/competitors/settings aren't lost in the switch.
async function migrateLocalFileIntoSupabaseIfEmpty() {
  const client = db.getClient();
  if (!client) return { migrated: false, reason: 'Supabase not configured' };

  const { data, error } = await client.from('dashboard_state').select('id').eq('id', ROW_ID).maybeSingle();
  if (error) {
    console.error('Supabase check error during migration:', error.message);
    return { migrated: false, reason: error.message };
  }
  if (data) return { migrated: false, reason: 'Supabase already has data' };

  const local = readFileStore();
  if (!local) return { migrated: false, reason: 'No local data-store.json to migrate' };

  await writeDataStore(local);
  console.log('Migrated server/data-store.json into Supabase (dashboard_state).');
  return { migrated: true };
}

module.exports = {
  readDataStore,
  writeDataStore,
  migrateLocalFileIntoSupabaseIfEmpty,
  usingSupabase: () => !!db.getClient(),
  DATA_FILE
};
