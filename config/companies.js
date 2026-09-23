// Curated ATS boards to poll. THIS LIST IS THE LEVERAGE OF THE WHOLE TOOL:
// a hand-picked set of genuinely global-hiring / worldwide-remote companies
// beats any generic aggregator feed for someone based in Algeria.
//
// These are seed guesses and MUST be verified. `npm run phase0` reports which
// boards resolve; delete the misses and add real ones. Find tokens by opening a
// company's careers page and checking whether the URL is boards.greenhouse.io,
// jobs.lever.co, or jobs.ashbyhq.com — the slug in that URL is the token.
export const companies = {
  greenhouse: [
    { token: 'gitlab', name: 'GitLab' },
    { token: 'hashicorp', name: 'HashiCorp' },
    { token: 'elastic', name: 'Elastic' },
    { token: 'cloudflare', name: 'Cloudflare' },
    { token: 'reddit', name: 'Reddit' },
    { token: 'discord', name: 'Discord' },
    { token: 'brex', name: 'Brex' },
    { token: 'coinbase', name: 'Coinbase' },
  ],
  lever: [
    { slug: 'netlify', name: 'Netlify' },
    { slug: 'brave', name: 'Brave' },
    { slug: 'kraken', name: 'Kraken' },
    { slug: 'ledger', name: 'Ledger' },
    { slug: 'voiceflow', name: 'Voiceflow' },
    { slug: 'mistral', name: 'Mistral AI' },
  ],
  ashby: [
    { slug: 'ramp', name: 'Ramp' },
    { slug: 'posthog', name: 'PostHog' },
    { slug: 'linear', name: 'Linear' },
    { slug: 'vanta', name: 'Vanta' },
    { slug: 'mercury', name: 'Mercury' },
    { slug: 'baseten', name: 'Baseten' },
    { slug: 'modal', name: 'Modal' },
    { slug: 'browserbase', name: 'Browserbase' },
  ],
};
