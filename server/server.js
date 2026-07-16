require('dotenv').config();
const path = require('path');
const express = require('express');
const cron = require('node-cron');
const instagram = require('./instagram');
const dataStore = require('./dataStore');
const db = require('./db');
const aiClient = require('./aiClient');
const scheduledReels = require('./scheduledReels');
const scheduler = require('./scheduler');
const reports = require('./reports');
const captionAgent = require('./captionAgent');
const frameExtract = require('./frameExtract');

const PORT = process.env.PORT || 3001;
const MONTHLY_CAP_USD = Number(process.env.MONTHLY_CAP_USD || 15);

// Routine agents run on cheap Haiku; agents where writing quality matters
// most (hooks, analysis, captions, reports) run on Sonnet.
const AGENT_MODEL = {
  ideas: 'claude-haiku-4-5-20251001',
  planner: 'claude-haiku-4-5-20251001',
  dm: 'claude-haiku-4-5-20251001',
  hook: 'claude-sonnet-5',
  analyst: 'claude-sonnet-5',
  competitorInsight: 'claude-sonnet-5'
};

const app = express();
app.use(express.json({ limit: '5mb' }));

const projectRoot = path.join(__dirname, '..');
app.use(express.static(projectRoot));

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    hasKey: !!process.env.ANTHROPIC_API_KEY,
    monthlyCapUsd: MONTHLY_CAP_USD,
    supabaseConfigured: db.supabaseConfigured()
  });
});

// Public (non-secret) config the browser needs for direct-to-Cloudinary
// uploads and to know whether scheduling is available.
app.get('/api/config', (req, res) => {
  res.json({
    cloudinary: {
      configured: instagram.cloudinaryConfigured(),
      cloudName: process.env.CLOUDINARY_CLOUD_NAME || null,
      uploadPreset: process.env.CLOUDINARY_UPLOAD_PRESET || null
    },
    schedulingEnabled: db.supabaseConfigured() && instagram.igConfigured() && instagram.cloudinaryConfigured()
  });
});

// Server-side mirror of the dashboard's data object, so it survives across
// devices/browsers/redeploys. Backed by Supabase when configured, otherwise
// falls back to a local JSON file (see dataStore.js).
app.get('/api/data', async (req, res) => {
  try {
    const stored = await dataStore.readDataStore();
    res.json(stored || {});
  } catch (err) {
    console.error('Error reading data store:', err.message);
    res.status(500).json({ error: 'Could not read data on the server.' });
  }
});

app.post('/api/data', async (req, res) => {
  const body = req.body;
  if (!body || typeof body !== 'object' || !Array.isArray(body.reels)) {
    return res.status(400).json({ error: "Invalid data payload -- expected the dashboard's full data object." });
  }
  try {
    await dataStore.writeDataStore(body);
    res.json({ ok: true });
  } catch (err) {
    console.error('Error writing data store:', err.message);
    res.status(500).json({ error: 'Could not save data on the server.' });
  }
});

app.post('/api/run-agent', async (req, res) => {
  const { agentKey, prompt } = req.body || {};

  if (!agentKey || !AGENT_MODEL[agentKey]) {
    return res.status(400).json({ error: 'Unknown agentKey: ' + agentKey });
  }
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Missing prompt text.' });
  }
  if (!aiClient.getClient()) {
    return res.status(400).json({
      error: 'ANTHROPIC_API_KEY is not set. Copy server/.env.example to server/.env and add your key, then restart the server.'
    });
  }

  try {
    const result = await aiClient.runPrompt(AGENT_MODEL[agentKey], prompt);
    res.json({ text: result.text, model: AGENT_MODEL[agentKey], inputTokens: result.inputTokens, outputTokens: result.outputTokens, costUsd: result.costUsd });
  } catch (err) {
    const detail = (err && err.message) || 'Unknown error calling the Claude API.';
    console.error('Anthropic API error:', detail);
    res.status(502).json({ error: detail });
  }
});

app.post('/api/chat', async (req, res) => {
  const { agentKey, systemPrompt, messages } = req.body || {};

  if (!agentKey || !AGENT_MODEL[agentKey]) {
    return res.status(400).json({ error: 'Unknown agentKey: ' + agentKey });
  }
  if (!Array.isArray(messages) || !messages.length) {
    return res.status(400).json({ error: 'messages array is required.' });
  }

  const client = aiClient.getClient();
  if (!client) {
    return res.status(400).json({
      error: 'ANTHROPIC_API_KEY is not set. Copy server/.env.example to server/.env and add your key, then restart the server.'
    });
  }

  const model = AGENT_MODEL[agentKey];

  try {
    const createParams = {
      model,
      max_tokens: aiClient.MAX_TOKENS,
      thinking: { type: 'disabled' },
      messages: messages.map((m) => ({ role: m.role, content: m.content }))
    };
    if (systemPrompt) createParams.system = systemPrompt;

    const message = await client.messages.create(createParams);

    const text = message.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n');

    const costUsd = aiClient.costFor(model, message.usage);

    res.json({ text, model, inputTokens: message.usage.input_tokens, outputTokens: message.usage.output_tokens, costUsd });
  } catch (err) {
    const detail = (err && err.message) || 'Unknown error calling the Claude API.';
    console.error('Anthropic API error:', detail);
    res.status(502).json({ error: detail });
  }
});

app.get('/api/instagram/health', async (req, res) => {
  if (!instagram.igConfigured()) {
    return res.json({ ok: true, connected: false, error: 'Instagram not configured — see INSTAGRAM-SETUP.md' });
  }
  try {
    const profile = await instagram.getProfile();
    res.json({ ok: true, connected: true, profile: profile, cloudinaryReady: instagram.cloudinaryConfigured() });
  } catch (err) {
    res.json({ ok: true, connected: false, error: (err && err.message) || 'Could not reach Instagram API.' });
  }
});

app.get('/api/instagram/sync', async (req, res) => {
  if (!instagram.igConfigured()) {
    return res.status(400).json({ error: 'Instagram not configured — see INSTAGRAM-SETUP.md' });
  }
  try {
    const [profile, media, accountInsights] = await Promise.all([
      instagram.getProfile(),
      instagram.getRecentMedia(12),
      instagram.getAccountInsights()
    ]);
    res.json({ profile: profile, media: media, accountInsights: accountInsights });
  } catch (err) {
    console.error('Instagram sync error:', err.message);
    res.status(502).json({ error: (err && err.message) || 'Could not sync from Instagram.' });
  }
});

app.get('/api/instagram/sentiment/:mediaId', async (req, res) => {
  if (!instagram.igConfigured()) {
    return res.status(400).json({ error: 'Instagram not configured — see INSTAGRAM-SETUP.md' });
  }
  if (!aiClient.getClient()) {
    return res.status(400).json({ error: 'ANTHROPIC_API_KEY is not set — sentiment analysis needs the Claude API backend configured (see AI-AGENT-SETUP.md).' });
  }
  try {
    const comments = await instagram.getComments(req.params.mediaId, 30);
    if (!comments.length) {
      return res.json({ sentiment: 'neutral', summary: 'No comments to analyze yet.', costUsd: 0 });
    }
    const commentText = comments.map((c) => '- ' + c.text).join('\n');
    const prompt = 'Classify the overall sentiment of these Instagram comments on a window cleaning business\'s reel as exactly one word: positive, mixed, negative, or neutral. Then give a one-sentence summary of what commenters are saying.\n\nReturn exactly this format:\nSENTIMENT: <word>\nSUMMARY: <one sentence>\n\nComments:\n' + commentText;

    const result = await aiClient.runPrompt(AGENT_MODEL.dm, prompt, { maxTokens: 300 });
    const sentimentMatch = result.text.match(/SENTIMENT:\s*(\w+)/i);
    const summaryMatch = result.text.match(/SUMMARY:\s*(.+)/i);

    res.json({
      sentiment: sentimentMatch ? sentimentMatch[1].toLowerCase() : 'neutral',
      summary: summaryMatch ? summaryMatch[1].trim() : result.text.trim(),
      costUsd: result.costUsd
    });
  } catch (err) {
    console.error('Sentiment analysis error:', err.message);
    res.status(502).json({ error: (err && err.message) || 'Could not analyze comment sentiment.' });
  }
});

// Manual "Publish Reel" button: video already uploaded to Cloudinary directly
// from the browser (see uploadVideoToCloudinary in index.html) -- this only
// ever receives a URL, never raw video bytes.
app.post('/api/instagram/publish', async (req, res) => {
  if (!instagram.igConfigured()) {
    return res.status(400).json({ error: 'Instagram not configured — see INSTAGRAM-SETUP.md' });
  }
  const { videoUrl, caption } = req.body || {};
  if (!videoUrl) {
    return res.status(400).json({ error: 'No video URL provided.' });
  }
  try {
    const result = await instagram.publishReel(videoUrl, caption || '');
    res.json({ id: result.id, permalink: result.permalink });
  } catch (err) {
    console.error('Instagram publish error:', err.message);
    res.status(502).json({ error: (err && err.message) || 'Could not publish to Instagram.' });
  }
});

// --- Feature 1: upload -> AI scan -> caption/hashtags ---
// Body: { videoUrl, publicId, filename } -- video already uploaded directly
// to Cloudinary from the browser. Generates caption/description/hashtags
// from the filename + brand voice, plus a best-effort visual frame grab.
app.post('/api/reels/analyze', async (req, res) => {
  const { videoUrl, publicId, filename } = req.body || {};
  if (!videoUrl) return res.status(400).json({ error: 'No video URL provided — upload to Cloudinary first.' });
  if (!aiClient.getClient()) {
    return res.status(400).json({ error: 'ANTHROPIC_API_KEY is not set — see AI-AGENT-SETUP.md.' });
  }

  try {
    const state = await dataStore.readDataStore();
    const settings = (state && state.settings) || {};
    const recentCaptions = state && Array.isArray(state.reels)
      ? [...state.reels].sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 8).map((r) => r.caption)
      : [];

    let frameBase64 = null;
    if (publicId && process.env.CLOUDINARY_CLOUD_NAME) {
      frameBase64 = await frameExtract.fetchFrameBase64FromCloudinary(process.env.CLOUDINARY_CLOUD_NAME, publicId);
    }

    const prompt = captionAgent.buildCaptionPrompt(settings, { filename, recentCaptions, hasFrame: !!frameBase64 });
    const result = await aiClient.runPrompt('claude-sonnet-5', prompt, frameBase64 ? { imageBase64: frameBase64, imageMediaType: 'image/jpeg' } : {});
    const parsed = captionAgent.parseCaptionResponse(result.text);

    res.json({
      videoUrl,
      sourceFilename: filename || '',
      caption: parsed.caption,
      description: parsed.description,
      hashtags: parsed.hashtags,
      hasFrame: !!frameBase64,
      costUsd: result.costUsd
    });
  } catch (err) {
    console.error('Reel analyze error:', err.message);
    res.status(502).json({ error: (err && err.message) || 'Could not analyze the video.' });
  }
});

// --- Feature 1: scheduled/trial reel queue ---
app.get('/api/scheduled-reels', async (req, res) => {
  try {
    const rows = await scheduledReels.listScheduledReels();
    res.json({ reels: rows });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.post('/api/scheduled-reels', async (req, res) => {
  const { videoUrl, sourceFilename, caption, hashtags, description, scheduledFor, isTrial, aiCostUsd } = req.body || {};
  if (!videoUrl) return res.status(400).json({ error: 'No video URL provided.' });
  try {
    const row = await scheduledReels.createScheduledReel({ videoUrl, sourceFilename, caption, hashtags, description, scheduledFor, isTrial, aiCostUsd });
    res.json({ reel: row });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.post('/api/scheduled-reels/:id/cancel', async (req, res) => {
  try {
    await scheduledReels.cancelScheduledReel(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.post('/api/scheduled-reels/:id/retry', async (req, res) => {
  try {
    await scheduledReels.retryScheduledReel(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// --- Feature 3: monthly top/bottom reels report ---
app.post('/api/reports/monthly/generate', async (req, res) => {
  const { monthKey, force } = req.body || {};
  const targetMonth = monthKey || reports.previousMonthKey();
  try {
    const report = await reports.generateMonthlyReport(targetMonth, { force: !!force });
    res.json({ report });
  } catch (err) {
    console.error('Monthly report error:', err.message);
    res.status(502).json({ error: err.message });
  }
});

// --- Scheduler tick, called by node-cron locally and by an external
// trigger (Vercel Cron / a free pinger like cron-job.org) when deployed. ---
function cronAuthorized(req) {
  if (!process.env.CRON_SECRET) return true; // no secret set -- open (fine for local dev only)
  const provided = req.headers['x-cron-secret'] || req.query.secret || (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '');
  return provided === process.env.CRON_SECRET;
}
async function handleCronRun(req, res) {
  if (!cronAuthorized(req)) return res.status(401).json({ error: 'Unauthorized — bad or missing cron secret.' });
  try {
    const result = await scheduler.runFullCycle();
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('Cron run error:', err.message);
    res.status(500).json({ error: err.message });
  }
}
app.get('/api/cron/run-scheduler', handleCronRun);
app.post('/api/cron/run-scheduler', handleCronRun);

app.get('/', (req, res) => {
  res.sendFile(path.join(projectRoot, 'index.html'));
});

app.use((err, req, res, next) => {
  console.error('Unexpected server error:', err);
  res.status(500).json({ error: 'Unexpected server error.' });
});

// Vercel imports this file as a serverless function module (see api/index.js)
// -- app.listen() and the local cron scheduler must not run there. Vercel's
// own Cron Jobs (or an external pinger) hit /api/cron/run-scheduler instead.
if (!process.env.VERCEL) {
  dataStore.migrateLocalFileIntoSupabaseIfEmpty().catch((e) => console.error('Migration check failed:', e.message));

  // Every minute: advance queued/publishing reels and check for a due monthly report.
  cron.schedule('* * * * *', () => {
    scheduler.runFullCycle().catch((e) => console.error('Scheduler tick error:', e.message));
  });

  app.listen(PORT, () => {
    console.log('Content Dashboard AI backend running at http://localhost:' + PORT);
    if (!process.env.ANTHROPIC_API_KEY) {
      console.log('WARNING: ANTHROPIC_API_KEY is not set. "Run with AI" buttons will show an error until you add it to server/.env');
    }
    if (!instagram.igConfigured()) {
      console.log('NOTE: Instagram is not configured. Sync/Publish will show an error until you add INSTAGRAM_ACCESS_TOKEN and INSTAGRAM_BUSINESS_ID to server/.env');
    }
    if (!db.supabaseConfigured()) {
      console.log('NOTE: Supabase is not configured — using the local server/data-store.json file instead. See SUPABASE-SETUP.md to persist data across devices/redeploys.');
    }
  });
}

module.exports = app;
