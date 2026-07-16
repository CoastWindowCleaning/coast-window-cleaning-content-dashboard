const dataStore = require('./dataStore');
const aiClient = require('./aiClient');

const REPORT_MODEL = 'claude-sonnet-5'; // quality matters here, same tier as the Analyst Agent

function monthKeyOf(dateStr) {
  return (dateStr || '').slice(0, 7); // 'YYYY-MM'
}

function previousMonthKey(refDate) {
  const d = refDate ? new Date(refDate) : new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - 1);
  return d.toISOString().slice(0, 7);
}

function monthLabel(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function engagementRate(r) {
  return r.views ? ((Number(r.likes) || 0) + (Number(r.comments) || 0)) / Number(r.views) : 0;
}
function outcomeScore(r) {
  return (Number(r.jobsBooked) || 0) * 3 + (Number(r.inquiries) || 0);
}

function rankReels(reels) {
  const anyOutcome = reels.some((r) => outcomeScore(r) > 0);
  return [...reels].sort((a, b) => {
    if (anyOutcome) {
      const diff = outcomeScore(b) - outcomeScore(a);
      if (diff !== 0) return diff;
    }
    return engagementRate(b) - engagementRate(a);
  });
}

function reelSummaryLine(r) {
  return '- ' + r.date + ' | "' + r.caption + '" | Views: ' + (r.views || 0) + ' | Likes: ' + (r.likes || 0) +
    ' | Comments: ' + (r.comments || 0) + ' | Engagement rate: ' + (engagementRate(r) * 100).toFixed(2) + '%' +
    ' | Content type: ' + (r.contentType || '—') + ' | Hook: ' + (r.hook || '—') + ' | Format: ' + (r.format || '—') +
    ' | Tone: ' + (r.captionTone || '—') + ' | Posted: ' + postingTimeNote(r) +
    ' | Inquiries: ' + (r.inquiries || 0) + ' | Jobs booked: ' + (r.jobsBooked || 0);
}

function postingTimeNote(r) {
  // Only the date is logged today, not a timestamp -- say so rather than inventing a time of day.
  const d = new Date(r.date + 'T00:00:00Z');
  if (isNaN(d)) return r.date || '—';
  return d.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' }) + ' (' + r.date + ', exact time not logged)';
}

function buildReportPrompt(settings, monthKey, top, bottom, allInMonth) {
  const s = settings || {};
  return 'You are the strategic intelligence layer for ' + (s.businessName || 'this business') + '\'s Instagram presence, writing a monthly performance report.\n\n' +
    'BUSINESS: ' + (s.businessName || 'Coast Window Cleaning') + '\nINSTAGRAM: ' + (s.handle || '@CHANGE_ME') + '\nMONTH: ' + monthLabel(monthKey) + ' (' + allInMonth.length + ' reels posted)\n\n' +
    'IMPORTANT — DO NOT INVENT DATA: only use what is provided below. Exact posting time-of-day is not logged, only the date/weekday — do not claim a specific hour.\n\n' +
    'TOP 3 REELS THIS MONTH (ranked by business outcome where logged, otherwise engagement rate):\n' +
    top.map(reelSummaryLine).join('\n') + '\n\n' +
    'BOTTOM 3 REELS THIS MONTH:\n' +
    bottom.map(reelSummaryLine).join('\n') + '\n\n' +
    'Return exactly this structure:\n\n' +
    '## WHAT THE TOP REELS HAVE IN COMMON\n' +
    'Name the shared pattern across content type, hook, format, tone, and posting day — be specific about which of these actually repeats across the top 3, don\'t force a pattern that isn\'t there.\n\n' +
    '## WHAT THE BOTTOM REELS HAVE IN COMMON\n' +
    'Same, for the bottom 3 — be blunt about the shared weakness.\n\n' +
    '## ONE CHANGE FOR NEXT MONTH\n' +
    'The single highest-leverage change to make next month based on this specific gap between top and bottom, in one or two sentences.';
}

async function generateMonthlyReport(monthKey, opts) {
  opts = opts || {};
  const state = await dataStore.readDataStore();
  if (!state || !Array.isArray(state.reels)) throw new Error('No dashboard data available yet.');

  const reelsInMonth = state.reels.filter((r) => monthKeyOf(r.date) === monthKey);
  if (reelsInMonth.length < 3 && !opts.force) {
    const report = {
      monthKey,
      generatedAt: new Date().toISOString(),
      reelCount: reelsInMonth.length,
      insufficientData: true,
      summary: 'Only ' + reelsInMonth.length + ' reel(s) logged for ' + monthLabel(monthKey) + ' — need at least 3 to generate a meaningful top/bottom report.',
      top: [],
      bottom: [],
      costUsd: 0
    };
    await saveReport(state, report);
    return report;
  }

  const ranked = rankReels(reelsInMonth);
  const top = ranked.slice(0, 3);
  const bottom = ranked.slice(-3).reverse();

  const prompt = buildReportPrompt(state.settings, monthKey, top, bottom, reelsInMonth);
  const result = await aiClient.runPrompt(REPORT_MODEL, prompt);

  const report = {
    monthKey,
    monthLabel: monthLabel(monthKey),
    generatedAt: new Date().toISOString(),
    reelCount: reelsInMonth.length,
    insufficientData: false,
    top: top.map((r) => ({ id: r.id, date: r.date, caption: r.caption, views: r.views, likes: r.likes, comments: r.comments, url: r.url })),
    bottom: bottom.map((r) => ({ id: r.id, date: r.date, caption: r.caption, views: r.views, likes: r.likes, comments: r.comments, url: r.url })),
    summary: result.text,
    costUsd: result.costUsd
  };
  await saveReport(state, report);
  return report;
}

async function saveReport(state, report) {
  if (!Array.isArray(state.monthlyReports)) state.monthlyReports = [];
  state.monthlyReports = state.monthlyReports.filter((r) => r.monthKey !== report.monthKey);
  state.monthlyReports.push(report);
  state.monthlyReports.sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  state.updatedAt = Date.now();
  await dataStore.writeDataStore(state);
}

// Called once per scheduler tick. Cheap no-op unless it's a new month and the
// prior month doesn't have a report yet.
async function maybeGenerateMonthlyReport() {
  if (!aiClient.getClient()) return { generated: false, reason: 'ANTHROPIC_API_KEY not set' };
  const state = await dataStore.readDataStore();
  if (!state) return { generated: false, reason: 'no data yet' };

  const targetMonth = previousMonthKey();
  const already = (state.monthlyReports || []).some((r) => r.monthKey === targetMonth);
  if (already) return { generated: false, reason: 'already have a report for ' + targetMonth };

  const report = await generateMonthlyReport(targetMonth);
  return { generated: true, monthKey: targetMonth, insufficientData: report.insufficientData };
}

module.exports = { generateMonthlyReport, maybeGenerateMonthlyReport, previousMonthKey, monthKeyOf, monthLabel };
