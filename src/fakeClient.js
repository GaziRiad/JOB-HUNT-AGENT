// Deterministic offline stand-in for the Anthropic client, so the full
// pipeline (scoring, tiering, drafting) can run without a key or network.
// Enable with JHA_FAKE_LLM=1. Never used on a real run.
export function makeFakeClient() {
  return {
    messages: {
      create: async ({ tools, messages }) => {
        const toolName = tools[0].name;
        const text = JSON.stringify(messages).toLowerCase();
        let input;
        if (toolName === 'record_assessment') {
          const contract = /contract|freelance/.test(text);
          const worldwide = /worldwide|anywhere|global|emea|europe/.test(text);
          const ai = /\bai\b|llm|automation|openai|anthropic/.test(text);
          input = {
            employmentType: contract ? 'contract' : 'full_time',
            eligibilityConfidence: worldwide ? 0.8 : 0.45,
            stackFit: 75,
            seniorityFit: 70,
            aiRelevance: ai ? 80 : 30,
            timezoneOverlap: 'overlaps EU / UTC+1 hours',
            score: 72,
            rationale: 'Deterministic fake assessment used for offline end-to-end testing.',
          };
        } else {
          input = {
            dm: 'Hi, I build React/Next and Node apps with AI integrations and saw this role. I think I could help here; open to a short chat this week?',
            letter: 'Dear team, I am a JavaScript/TypeScript engineer focused on React, Next.js and Node, with recent work wiring LLM features and automation into production apps. This role lines up with what I do best and my hours overlap EU time well. I would welcome the chance to talk.',
          };
        }
        return { content: [{ type: 'tool_use', name: toolName, input }], usage: { input_tokens: 500, output_tokens: 150 } };
      },
    },
  };
}
