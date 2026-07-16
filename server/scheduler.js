const db = require('./db');
const instagram = require('./instagram');
const dataStore = require('./dataStore');
const reports = require('./reports');

function finalCaption(row) {
  const parts = [row.caption || ''];
  if (row.hashtags) parts.push(row.hashtags);
  return parts.filter(Boolean).join('\n\n');
}

async function mirrorIntoDashboardReels(row, result) {
  const state = await dataStore.readDataStore();
  if (!state || !Array.isArray(state.reels)) return;
  const nextId = state.nextReelId || (Math.max(0, ...state.reels.map((r) => r.id || 0)) + 1);
  state.reels.push({
    id: nextId,
    date: new Date().toISOString().slice(0, 10),
    caption: (row.caption || '').slice(0, 200) || '(no caption)',
    views: 0,
    likes: 0,
    comments: 0,
    url: result.permalink || '',
    igMediaId: result.id,
    hashtagsUsed: row.hashtags || '',
    fromQueue: true,
    queuedReelId: row.id
  });
  state.nextReelId = nextId + 1;
  state.updatedAt = Date.now();
  await dataStore.writeDataStore(state);
}

// One tick: (1) start any due queued posts by creating an IG media container,
// (2) advance in-progress containers one step, publishing once IG finishes
// processing. Deliberately does not sleep/poll in a loop -- each step is a
// single fast API call so this is safe to run inside a short-lived
// serverless invocation as well as a long-running local process.
async function runSchedulerTick() {
  const client = db.getClient();
  if (!client) return { ran: false, reason: 'Supabase not configured' };
  if (!instagram.igConfigured() || !instagram.cloudinaryConfigured()) {
    return { ran: false, reason: 'Instagram/Cloudinary not configured' };
  }

  const nowIso = new Date().toISOString();
  let started = 0, published = 0, failed = 0;

  const { data: due, error: dueErr } = await client
    .from('scheduled_reels')
    .select('*')
    .eq('status', 'queued')
    .lte('scheduled_for', nowIso);
  if (dueErr) throw new Error('Scheduler: could not read due posts: ' + dueErr.message);

  for (const row of due || []) {
    try {
      const creationId = await instagram.createReelContainer(row.video_url, finalCaption(row));
      await client.from('scheduled_reels').update({ status: 'publishing', ig_creation_id: creationId }).eq('id', row.id);
      started++;
    } catch (e) {
      await client.from('scheduled_reels').update({ status: 'failed', error_message: e.message }).eq('id', row.id);
      failed++;
    }
  }

  const { data: publishing, error: pubErr } = await client
    .from('scheduled_reels')
    .select('*')
    .eq('status', 'publishing');
  if (pubErr) throw new Error('Scheduler: could not read in-progress posts: ' + pubErr.message);

  for (const row of publishing || []) {
    try {
      const statusCode = await instagram.checkContainerStatus(row.ig_creation_id);
      if (statusCode === 'FINISHED') {
        const result = await instagram.publishContainer(row.ig_creation_id);
        await client.from('scheduled_reels').update({
          status: 'posted', ig_media_id: result.id, ig_permalink: result.permalink, posted_at: new Date().toISOString()
        }).eq('id', row.id);
        await mirrorIntoDashboardReels(row, result);
        published++;
      } else if (statusCode === 'ERROR' || statusCode === 'EXPIRED') {
        await client.from('scheduled_reels').update({ status: 'failed', error_message: 'Instagram failed to process the video (status: ' + statusCode + ').' }).eq('id', row.id);
        failed++;
      }
      // else IN_PROGRESS -- leave as-is, checked again next tick
    } catch (e) {
      await client.from('scheduled_reels').update({ status: 'failed', error_message: e.message }).eq('id', row.id);
      failed++;
    }
  }

  return { ran: true, started, published, failed, checkedInProgress: (publishing || []).length };
}

async function runFullCycle() {
  const schedulerResult = await runSchedulerTick();
  let reportResult = { generated: false, reason: 'skipped' };
  try {
    reportResult = await reports.maybeGenerateMonthlyReport();
  } catch (e) {
    reportResult = { generated: false, reason: e.message };
  }
  return { scheduler: schedulerResult, monthlyReport: reportResult };
}

module.exports = { runSchedulerTick, runFullCycle };
