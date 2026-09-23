// Small fetch helpers built on Node 20's native fetch (no dependency).
// NOTE: native fetch does not read HTTP(S)_PROXY env vars. On a normal machine
// or a GitHub Actions runner egress is direct, so this is fine. Inside a
// restricted Claude cloud session outbound calls are blocked; that only affects
// in-session testing, not the deployed agent.
export const USER_AGENT = 'job-hunt-agent (personal use; +https://github.com)';

const DEFAULT_TIMEOUT = Number(process.env.JHA_TIMEOUT_MS) || 20000;

async function request(url, { timeoutMs = DEFAULT_TIMEOUT, headers = {}, accept } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, ...(accept ? { Accept: accept } : {}), ...headers },
      signal: controller.signal,
      redirect: 'follow',
    });
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status} for ${url}`);
      err.status = res.status;
      throw err;
    }
    return res;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchJson(url, opts = {}) {
  const res = await request(url, { accept: 'application/json', ...opts });
  return res.json();
}

export async function fetchText(url, opts = {}) {
  const res = await request(url, { accept: 'text/*, application/xml, application/rss+xml', ...opts });
  return res.text();
}
