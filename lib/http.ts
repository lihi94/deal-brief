type CacheEntry = { expires: number; status: number; body: string; url: string };

const cache = new Map<string, CacheEntry>();

export type GetTextOptions = {
  headers?: Record<string, string>;
  timeoutMs?: number;
  ttlMs?: number;
  cacheKey?: string;
};

export async function getText(url: string, options: GetTextOptions = {}): Promise<{
  ok: boolean;
  status: number;
  text: string;
  finalUrl: string;
}> {
  const ttl = options.ttlMs ?? 10 * 60 * 1000;
  const key = options.cacheKey ?? `${url}|${options.headers?.["User-Agent"] ?? ""}|${options.headers?.Cookie ?? ""}`;
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) {
    return { ok: hit.status >= 200 && hit.status < 300, status: hit.status, text: hit.body, finalUrl: hit.url };
  }

  const response = await fetch(url, {
    headers: options.headers,
    signal: AbortSignal.timeout(options.timeoutMs ?? 8000),
    redirect: "follow",
  });
  const text = await response.text();
  if (response.ok && text.length < 8_000_000) {
    cache.set(key, { expires: Date.now() + ttl, status: response.status, body: text, url: response.url });
  }
  return { ok: response.ok, status: response.status, text, finalUrl: response.url };
}

export function clearHttpCache(): void {
  cache.clear();
}
