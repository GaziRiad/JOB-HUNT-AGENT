// Your candidate profile. Everything downstream (prefilter + LLM scoring) reads
// from here, so tune this rather than editing logic.
export const profile = {
  name: 'Riad',
  basedIn: 'Algeria',
  timezone: 'UTC+1',
  // Used by the LLM stage for seniority fit.
  seniority: ['mid', 'senior'],
  yearsExperience: 4,

  // Any ONE of these appearing in a posting passes the stack gate.
  // Keep them lowercase; short tokens are matched on word boundaries.
  stackKeywords: [
    'javascript', 'typescript', 'react', 'react.js', 'next.js', 'nextjs',
    'node', 'node.js', 'nodejs', 'express', 'nest.js', 'vue', 'svelte',
    'frontend', 'front-end', 'backend', 'back-end', 'full stack', 'full-stack', 'fullstack',
    'web developer', 'software engineer', 'software developer',
    'api', 'rest', 'graphql', 'postgres', 'postgresql', 'mysql', 'mongodb', 'prisma',
    // AI-integration wedge (highest rate premium in 2026)
    'ai/ml', 'llm', 'llms', 'openai', 'anthropic', 'claude', 'rag',
    'ai integration', 'ai engineer', 'automation', 'workflow automation',
    'n8n', 'zapier', 'make.com', 'prompt', 'chatbot', 'agent',
  ],

  // Regions the LLM should treat as strong eligibility signals for you.
  eligibleSignals: ['worldwide', 'anywhere', 'global', 'emea', 'europe', 'eor', 'employer of record', 'contractor', 'b2b'],
};
