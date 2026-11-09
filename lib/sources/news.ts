import { BROWSER_UA } from "../constants";
import { getText } from "../http";
import type { Headline, SourceRef } from "../types";
import { parseRss } from "./rss";

export async function fetchHeadlines(
  query: string,
  retrievedAt: string,
  options: { ticker?: string } = {},
): Promise<{ headlines: Headline[]; sources: SourceRef[]; errors: string[] }> {
  const headlines: Headline[] = [];
  const sources: SourceRef[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();

  const jobs: { name: string; url: string }[] = [];
  if (options.ticker) {
    jobs.push({
      name: "Yahoo Finance headlines",
      url: `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(options.ticker)}&region=US&lang=en-US`,
    });
  }
  const newsQuery = options.ticker ? `"${query}" OR ${options.ticker}` : `"${query}"`;
  jobs.push({
    name: "Google News RSS",
    url: `https://news.google.com/rss/search?q=${encodeURIComponent(newsQuery)}&hl=en-US&gl=US&ceid=US:en`,
  });

  const results = await Promise.all(
    jobs.map(async (job) => {
      try {
        const response = await getText(job.url, {
          headers: { "User-Agent": BROWSER_UA, Accept: "application/rss+xml, application/xml, text/xml" },
          timeoutMs: 8000,
          cacheKey: `news:${job.url}`,
        });
        return { job, response };
      } catch {
        return { job, response: null };
      }
    }),
  );

  for (const { job, response } of results) {
    if (!response?.ok) {
      errors.push(`${job.name} did not respond${response ? ` (HTTP ${response.status})` : ""}.`);
      continue;
    }
    sources.push({ name: job.name, url: job.url, retrievedAt });
    for (const item of parseRss(response.text, 5)) {
      const key = item.title.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      headlines.push(item);
      if (headlines.length >= 4) break;
    }
  }

  return { headlines: headlines.slice(0, 4), sources, errors };
}
