const crypto = require('crypto');

// A stable fingerprint of the current comment set (text + engagement counts)
// so the caller can skip re-running the AI analysis when nothing has
// changed since the last time this reel was analyzed.
function fingerprintComments(comments) {
  const normalized = comments.map((c) => ({ t: c.text, u: c.username, l: c.likeCount || 0, r: c.replyCount || 0 }));
  return crypto.createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}

function buildCommentSummaryPrompt(comments) {
  const ranked = [...comments].sort((a, b) => ((b.likeCount || 0) + (b.replyCount || 0)) - ((a.likeCount || 0) + (a.replyCount || 0)));
  const lines = ranked.map((c) =>
    '- "' + (c.text || '').replace(/"/g, '\'') + '" (@' + (c.username || 'unknown') + ', ' + (c.likeCount || 0) + ' likes, ' + (c.replyCount || 0) + ' replies)'
  );

  return 'You are reading the Instagram comments on a window cleaning business\'s Reel to produce a real "how this video was received" summary -- not just a one-word sentiment label.\n\n' +
    'Comments are listed below with their like/reply counts. Weigh comments with more likes/replies as more representative of overall reception, but do not ignore a genuine question or complaint just because it has low engagement.\n\n' +
    'COMMENTS (' + comments.length + ' total):\n' + lines.join('\n') + '\n\n' +
    'Return exactly this structure. Use "None." (with the period) for any section with nothing to report -- do not invent content to fill a section.\n\n' +
    'RECEPTION: <one word: positive, mixed, negative, or neutral>\n' +
    'REASON: <one sentence explaining the reception>\n' +
    'THEMES:\n- <recurring theme 1>\n- <recurring theme 2>\n- <recurring theme 3, optional>\n' +
    'UNANSWERED_QUESTIONS:\n- <a direct question asked in the comments, quoted or closely paraphrased>\n' +
    'COMPLAINTS:\n- "<short verbatim quote>" — <one clause of context>';
}

// Line-based parser (not one big regex) so odd punctuation/colons/dashes
// inside real comment text can't break section boundaries.
function parseCommentSummaryResponse(text) {
  const result = { reception: 'neutral', reason: '', themes: [], unansweredQuestions: [], complaints: [] };
  let section = null;

  text.split('\n').forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) return;

    const receptionMatch = line.match(/^RECEPTION:\s*(\w+)/i);
    if (receptionMatch) { result.reception = receptionMatch[1].toLowerCase(); section = null; return; }

    const reasonMatch = line.match(/^REASON:\s*(.+)/i);
    if (reasonMatch) { result.reason = reasonMatch[1].trim(); section = null; return; }

    if (/^THEMES:?$/i.test(line)) { section = 'themes'; return; }
    if (/^UNANSWERED_QUESTIONS:?$/i.test(line)) { section = 'unansweredQuestions'; return; }
    if (/^COMPLAINTS:?$/i.test(line)) { section = 'complaints'; return; }

    if (section && /^[-*]\s*/.test(line)) {
      const item = line.replace(/^[-*]\s*/, '').trim();
      if (item && !/^none\.?$/i.test(item)) result[section].push(item);
    }
  });

  return result;
}

module.exports = { fingerprintComments, buildCommentSummaryPrompt, parseCommentSummaryResponse };
