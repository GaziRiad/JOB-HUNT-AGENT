// Thin Anthropic wrapper: model selection, structured (forced-tool) calls,
// and rough cost accounting. The plan uses Haiku for scoring and Sonnet for
// drafting; override via env if you want to bump to Opus.
import Anthropic from '@anthropic-ai/sdk';

export const MODELS = {
  score: process.env.JHA_SCORE_MODEL || 'claude-haiku-4-5',
  // Haiku by default to keep cost minimal. Bump drafts to a stronger model with
  // JHA_DRAFT_MODEL=claude-sonnet-5 once you care about outreach polish.
  draft: process.env.JHA_DRAFT_MODEL || 'claude-haiku-4-5',
};

// USD per million tokens (claude-api reference, 2026-06). For cost logging only.
const PRICES = {
  'claude-haiku-4-5': { in: 1.0, out: 5.0 },
  'claude-sonnet-5': { in: 2.0, out: 10.0 },
  'claude-opus-5': { in: 5.0, out: 25.0 },
};

export function createClient() {
  if (!process.env.ANTHROPIC_API_KEY) return null; // pipeline runs unscored without a key
  return new Anthropic();
}

export function estimateCost(model, usage) {
  const p = PRICES[model];
  if (!p || !usage) return 0;
  const inTok = (usage.input_tokens || 0) + (usage.cache_read_input_tokens || 0) + (usage.cache_creation_input_tokens || 0);
  const outTok = usage.output_tokens || 0;
  return (inTok / 1e6) * p.in + (outTok / 1e6) * p.out;
}

// Rough up-front estimate (before spending) so a run can show its cost first.
const ROUGH = { scoreIn: 1000, scoreOut: 180, draftIn: 700, draftOut: 400 };
export function estimateRunCost(nScored, nDrafted) {
  const sp = PRICES[MODELS.score] || PRICES['claude-haiku-4-5'];
  const dp = PRICES[MODELS.draft] || PRICES['claude-haiku-4-5'];
  const score = nScored * ((ROUGH.scoreIn / 1e6) * sp.in + (ROUGH.scoreOut / 1e6) * sp.out);
  const draft = nDrafted * ((ROUGH.draftIn / 1e6) * dp.in + (ROUGH.draftOut / 1e6) * dp.out);
  return score + draft;
}

// Force one tool call so we always get structured JSON back (Haiku 4.5 and
// Sonnet 5 both support forced tool_choice).
export async function callStructured(client, { model, system, user, tool, maxTokens = 800 }) {
  const res = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system,
    tools: [tool],
    tool_choice: { type: 'tool', name: tool.name },
    messages: [{ role: 'user', content: user }],
  });
  const block = (res.content || []).find((b) => b.type === 'tool_use' && b.name === tool.name);
  return { input: block ? block.input : null, usage: res.usage, model };
}
