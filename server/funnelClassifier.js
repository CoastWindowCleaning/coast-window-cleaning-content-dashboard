// Mirrors the TOFU/MOFU/BOFU definitions baked into the Ideas Agent's master
// prompt (buildIdeasPrompt in index.html) so a manually-typed idea gets
// classified the same way a batch-pasted one does via the agent tool call.
const FUNNEL_STAGE_DEFINITIONS = [
  'TOFU (Top of Funnel) — broad-reach awareness content for people who don\'t know this business yet: satisfying/entertaining hooks, general education, relatability. Optimizes for reach and follows, not an immediate sale.',
  'MOFU (Middle of Funnel) — consideration and trust-building content for people who already know the business exists: process/behind-the-scenes, credibility, testimonials, expertise, addressing objections.',
  'BOFU (Bottom of Funnel) — conversion-focused content for someone ready to book: pricing transparency, direct offers, strong CTAs, urgency, "DM to book."'
].map((l) => '- ' + l).join('\n');

function buildFunnelClassifyPrompt(ideaText) {
  return 'Classify this Instagram Reel idea for a local window cleaning business into exactly one marketing funnel stage.\n\n' +
    'FUNNEL STAGES:\n' + FUNNEL_STAGE_DEFINITIONS + '\n\n' +
    'IDEA: "' + ideaText + '"\n\n' +
    'Return exactly one word: TOFU, MOFU, or BOFU. Nothing else — no punctuation, no explanation.';
}

function parseFunnelClassifyResponse(text) {
  const match = (text || '').match(/\b(TOFU|MOFU|BOFU)\b/i);
  return match ? match[1].toUpperCase() : null;
}

module.exports = { FUNNEL_STAGE_DEFINITIONS, buildFunnelClassifyPrompt, parseFunnelClassifyResponse };
