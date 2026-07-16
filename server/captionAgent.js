// Mirrors the brand-voice rules baked into the Hook & Script / Analyst agent
// prompts in index.html (buildHookPrompt / buildAnalystPrompt) so an
// uploaded video gets the same voice whether it was scripted by the Hook
// Agent first or dropped in cold.
const BRAND_VOICE = [
  'Authentic, direct, results-focused — no corporate fluff',
  'Local pride in the service area — reference the market, weather, commercial landscape where relevant',
  'Work ethic visible — the crew, tools, and process are part of the appeal, not just the finished result',
  'Minimalist aesthetic — clean compositions, no excessive overlays',
  'Value-driven — tie recommendations back to customer ROI (cleaner windows = curb appeal = property value), not vanity metrics alone',
  'Never use emojis anywhere — the brand voice is clean and text-only'
].map((r) => '- ' + r).join('\n');

function cleanFilename(filename) {
  if (!filename) return '(no filename provided)';
  const base = filename.replace(/\.[^.]+$/, '');
  return base.replace(/[_\-]+/g, ' ').replace(/\s+/g, ' ').trim() || filename;
}

function buildCaptionPrompt(settings, meta) {
  const s = settings || {};
  const cleanedName = cleanFilename(meta.filename);
  const recentCaptions = (meta.recentCaptions || []).slice(0, 8).map((c) => '- ' + c).join('\n') || '(none logged yet)';

  const visualNote = meta.hasFrame
    ? 'A still frame from the video is attached as an image — base what the video actually shows on that frame, not just the filename.'
    : 'No visual frame is available for this upload — a still frame could not be extracted (this is expected in some hosting environments). Work from the filename and business context only, and keep the description conservative/generic about specific visual details you can\'t actually see rather than inventing them.';

  return 'You are the same short-form scriptwriter/copywriter who writes this business\'s Instagram Reel captions and hashtags.\n\n' +
    'BUSINESS: ' + (s.businessName || 'Coast Window Cleaning') + ' — residential + commercial window cleaning\n' +
    'INSTAGRAM: ' + (s.handle || '@CHANGE_ME') + '\n\n' +
    'BRAND VOICE CONSTRAINTS (every output must respect these):\n' + BRAND_VOICE + '\n\n' +
    'A video file was just uploaded to be posted as a Reel. Its filename (cleaned up) is:\n"' + cleanedName + '"\n\n' +
    visualNote + '\n\n' +
    'RECENTLY POSTED CAPTIONS (avoid repeating these hooks/phrasing):\n' + recentCaptions + '\n\n' +
    'Return exactly this structure, nothing else:\n\n' +
    'CAPTION: <one caption, 2-4 sentences, ends with a clear low-friction local call-to-action like "DM for a free quote" or "Book your free quote — link in bio">\n' +
    'DESCRIPTION: <one sentence describing what this video most likely shows, for the business owner to quickly confirm/correct before posting>\n' +
    'HASHTAGS: <exactly 8 hashtags, space-separated, mixing niche window-cleaning/home-service tags with local relevance (use a [CITY] placeholder only if no city is known)>';
}

function parseCaptionResponse(text) {
  const captionMatch = text.match(/CAPTION:\s*([\s\S]*?)(?:\nDESCRIPTION:|$)/i);
  const descriptionMatch = text.match(/DESCRIPTION:\s*([\s\S]*?)(?:\nHASHTAGS:|$)/i);
  const hashtagsMatch = text.match(/HASHTAGS:\s*([\s\S]*)$/i);
  return {
    caption: captionMatch ? captionMatch[1].trim() : text.trim(),
    description: descriptionMatch ? descriptionMatch[1].trim() : '',
    hashtags: hashtagsMatch ? hashtagsMatch[1].trim() : ''
  };
}

module.exports = { buildCaptionPrompt, parseCaptionResponse, cleanFilename };
