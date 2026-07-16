const GRAPH_VERSION = 'v21.0';
const GRAPH_BASE = 'https://graph.facebook.com/' + GRAPH_VERSION;

function igConfigured() {
  return !!(process.env.INSTAGRAM_ACCESS_TOKEN && process.env.INSTAGRAM_BUSINESS_ID);
}

// Video files upload directly from the browser to Cloudinary (unsigned
// upload preset) so raw video bytes never pass through this server -- that
// avoids Vercel's ~4.5MB serverless request body limit, which a multi-minute
// reel would blow past instantly. This server only ever needs the resulting
// Cloudinary URL, plus the cloud name to build a frame-thumbnail URL.
function cloudinaryConfigured() {
  return !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_UPLOAD_PRESET);
}

async function igFetch(path, params, method) {
  method = method || 'GET';
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;

  if (method === 'GET') {
    const url = new URL(GRAPH_BASE + path);
    url.search = new URLSearchParams(Object.assign({}, params, { access_token: token })).toString();
    const resp = await fetch(url);
    const json = await resp.json();
    if (json.error) throw new Error(json.error.message || 'Instagram API error');
    return json;
  }

  const url = new URL(GRAPH_BASE + path);
  const body = new URLSearchParams(Object.assign({}, params, { access_token: token }));
  const resp = await fetch(url, { method, body });
  const json = await resp.json();
  if (json.error) throw new Error(json.error.message || 'Instagram API error');
  return json;
}

async function getProfile() {
  const igId = process.env.INSTAGRAM_BUSINESS_ID;
  const data = await igFetch('/' + igId, { fields: 'username,followers_count,media_count' });
  return {
    username: data.username,
    followersCount: data.followers_count,
    mediaCount: data.media_count
  };
}

async function getAccountInsights() {
  const igId = process.env.INSTAGRAM_BUSINESS_ID;
  try {
    // profile_views/website_clicks are "total_value" metrics -- they require
    // metric_type=total_value and return { total_value: { value } } rather
    // than the older { values: [...] } time-series shape.
    const insights = await igFetch('/' + igId + '/insights', { metric: 'profile_views,website_clicks', period: 'day', metric_type: 'total_value' });
    const result = {};
    (insights.data || []).forEach(function (d) {
      const value = d.total_value ? d.total_value.value : (d.values && d.values.length ? d.values[d.values.length - 1].value : null);
      result[d.name] = value != null ? value : null;
    });
    return { profileViews: result.profile_views != null ? result.profile_views : null, websiteClicks: result.website_clicks != null ? result.website_clicks : null };
  } catch (e) {
    console.warn('Account insights unavailable: ' + e.message);
    return { profileViews: null, websiteClicks: null };
  }
}

async function getMediaInsights(mediaId, isReel) {
  // Note: Instagram's Graph API renamed the "plays" metric to "views" (v21.0+).
  // Using the old name makes the WHOLE metric set fail with an OAuthException.
  const metricSets = isReel
    ? ['views,reach,saved,ig_reels_avg_watch_time', 'views,reach,saved', 'views']
    : ['reach,saved'];

  let lastError = null;
  for (const metricSet of metricSets) {
    try {
      const insights = await igFetch('/' + mediaId + '/insights', { metric: metricSet });
      const result = {};
      (insights.data || []).forEach(function (d) {
        result[d.name] = d.values && d.values[0] ? d.values[0].value : null;
      });
      return result;
    } catch (e) {
      lastError = e;
      // fall through to the next, smaller metric set -- some are only valid for certain media types/ages
    }
  }
  if (lastError) {
    console.warn('Media insights unavailable for ' + mediaId + ': ' + lastError.message);
  }
  return {};
}

async function getRecentMedia(limit) {
  const igId = process.env.INSTAGRAM_BUSINESS_ID;
  const data = await igFetch('/' + igId + '/media', {
    fields: 'id,caption,media_type,media_product_type,permalink,timestamp,like_count,comments_count',
    limit: limit || 12
  });
  const media = data.data || [];

  return Promise.all(media.map(async function (m) {
    const isReel = m.media_product_type === 'REELS';
    const insightsData = await getMediaInsights(m.id, isReel);
    const avgWatchMs = insightsData.ig_reels_avg_watch_time;

    return {
      id: m.id,
      caption: m.caption || '',
      mediaType: m.media_type,
      permalink: m.permalink,
      timestamp: m.timestamp,
      likeCount: m.like_count || 0,
      commentsCount: m.comments_count || 0,
      views: insightsData.views != null ? insightsData.views : null,
      reach: insightsData.reach != null ? insightsData.reach : null,
      saved: insightsData.saved != null ? insightsData.saved : null,
      avgWatchTimeSec: avgWatchMs != null ? Math.round(avgWatchMs / 1000) : null
    };
  }));
}

async function getComments(mediaId, limit) {
  // Prefer like_count + reply summary so callers can weigh comments by
  // engagement, not just count them equally -- falls back to plainer field
  // sets since replies.summary(true) isn't guaranteed on every API version.
  const fieldSets = [
    'text,username,timestamp,like_count,replies.summary(true)',
    'text,username,timestamp,like_count',
    'text,username,timestamp'
  ];

  let data = null, lastError = null;
  for (const fields of fieldSets) {
    try {
      data = await igFetch('/' + mediaId + '/comments', { fields, limit: limit || 30 });
      break;
    } catch (e) {
      lastError = e;
    }
  }
  if (!data) {
    console.warn('Comments unavailable for ' + mediaId + ': ' + (lastError && lastError.message));
    return [];
  }

  return (data.data || []).map(function (c) {
    return {
      text: c.text || '',
      username: c.username || '',
      timestamp: c.timestamp,
      likeCount: c.like_count != null ? c.like_count : 0,
      replyCount: (c.replies && c.replies.summary) ? (c.replies.summary.total_count || 0) : 0
    };
  });
}

// --- Resumable publish steps (used by the scheduler, which advances a queued
// reel one short step per cron tick instead of blocking an HTTP request for
// up to 3 minutes -- serverless platforms like Vercel kill long-running
// function invocations, so nothing here may sleep for more than one fetch). ---

async function createReelContainer(videoUrl, caption) {
  const igId = process.env.INSTAGRAM_BUSINESS_ID;
  const container = await igFetch('/' + igId + '/media', {
    media_type: 'REELS',
    video_url: videoUrl,
    caption: caption || ''
  }, 'POST');
  return container.id;
}

async function checkContainerStatus(creationId) {
  const statusResp = await igFetch('/' + creationId, { fields: 'status_code' });
  return statusResp.status_code; // IN_PROGRESS | FINISHED | ERROR | EXPIRED
}

async function publishContainer(creationId) {
  const igId = process.env.INSTAGRAM_BUSINESS_ID;
  const publishResp = await igFetch('/' + igId + '/media_publish', { creation_id: creationId }, 'POST');
  const mediaInfo = await igFetch('/' + publishResp.id, { fields: 'permalink' });
  return { id: publishResp.id, permalink: mediaInfo.permalink };
}

// Blocking convenience wrapper around the three steps above, for the manual
// "Publish Reel" button (synchronous UI flow, run from the local server).
// Not used by the scheduler -- see server/scheduler.js.
async function publishReel(videoUrl, caption) {
  const creationId = await createReelContainer(videoUrl, caption);

  const maxAttempts = 40; // ~3 minutes at 4.5s intervals
  let status = 'IN_PROGRESS';
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(function (r) { setTimeout(r, 4500); });
    status = await checkContainerStatus(creationId);
    if (status === 'FINISHED' || status === 'ERROR') break;
  }
  if (status === 'ERROR') throw new Error('Instagram failed to process the video.');
  if (status !== 'FINISHED') throw new Error('Instagram is still processing the video after 3 minutes — check your Instagram app shortly, or try again.');

  return publishContainer(creationId);
}

module.exports = {
  igConfigured: igConfigured,
  cloudinaryConfigured: cloudinaryConfigured,
  getProfile: getProfile,
  getAccountInsights: getAccountInsights,
  getRecentMedia: getRecentMedia,
  getComments: getComments,
  publishReel: publishReel,
  createReelContainer: createReelContainer,
  checkContainerStatus: checkContainerStatus,
  publishContainer: publishContainer
};
