const db = require('./db');

function requireClient() {
  const client = db.getClient();
  if (!client) throw new Error('Supabase is not configured — scheduling and trial posting need it. See SUPABASE-SETUP.md.');
  return client;
}

async function listScheduledReels() {
  const client = requireClient();
  const { data, error } = await client
    .from('scheduled_reels')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw new Error('Could not load the content queue: ' + error.message);
  return data || [];
}

async function createScheduledReel(row) {
  const client = requireClient();
  const { data, error } = await client
    .from('scheduled_reels')
    .insert({
      video_url: row.videoUrl,
      source_filename: row.sourceFilename || null,
      caption: row.caption || '',
      hashtags: row.hashtags || '',
      description: row.description || '',
      scheduled_for: row.scheduledFor || new Date().toISOString(),
      is_trial: !!row.isTrial,
      status: 'queued',
      ai_cost_usd: row.aiCostUsd || null
    })
    .select()
    .single();
  if (error) throw new Error('Could not queue the reel: ' + error.message);
  return data;
}

async function cancelScheduledReel(id) {
  const client = requireClient();
  const { error } = await client
    .from('scheduled_reels')
    .update({ status: 'canceled' })
    .eq('id', id)
    .eq('status', 'queued'); // only queued (not-yet-started) posts can be canceled
  if (error) throw new Error('Could not cancel: ' + error.message);
}

async function retryScheduledReel(id) {
  const client = requireClient();
  const { error } = await client
    .from('scheduled_reels')
    .update({ status: 'queued', scheduled_for: new Date().toISOString(), error_message: null, ig_creation_id: null })
    .eq('id', id)
    .eq('status', 'failed');
  if (error) throw new Error('Could not retry: ' + error.message);
}

module.exports = {
  listScheduledReels,
  createScheduledReel,
  cancelScheduledReel,
  retryScheduledReel
};
