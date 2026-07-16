const Anthropic = require('@anthropic-ai/sdk');

// Per-million-token pricing in USD. Anthropic's introductory Sonnet 5 rate
// ($2/$10) runs through Aug 31 2026, then reverts to $3/$15 -- update here if
// pricing changes. Source: https://platform.claude.com/docs/en/about-claude/pricing
const PRICING = {
  'claude-sonnet-5': { input: 2.00, output: 10.00 },
  'claude-haiku-4-5-20251001': { input: 1.00, output: 5.00 }
};

const MAX_TOKENS = 4096;

let anthropic = null;
function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!anthropic) anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return anthropic;
}

function costFor(model, usage) {
  const price = PRICING[model];
  if (!price) return 0;
  return (usage.input_tokens / 1e6) * price.input + (usage.output_tokens / 1e6) * price.output;
}

// Single-shot prompt helper used by server-side/cron-triggered AI work
// (caption generation, monthly reports) where there's no chat history and no
// browser necessarily open to relay the request.
async function runPrompt(model, prompt, opts) {
  opts = opts || {};
  const client = getClient();
  if (!client) throw new Error('ANTHROPIC_API_KEY is not set.');

  const content = opts.imageBase64
    ? [
        { type: 'image', source: { type: 'base64', media_type: opts.imageMediaType || 'image/jpeg', data: opts.imageBase64 } },
        { type: 'text', text: prompt }
      ]
    : prompt;

  const message = await client.messages.create({
    model,
    max_tokens: opts.maxTokens || MAX_TOKENS,
    thinking: { type: 'disabled' },
    messages: [{ role: 'user', content }]
  });

  const text = message.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
  return {
    text,
    costUsd: costFor(model, message.usage),
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens
  };
}

module.exports = { getClient, runPrompt, costFor, PRICING, MAX_TOKENS };
