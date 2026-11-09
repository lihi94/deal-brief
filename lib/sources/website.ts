import { BROWSER_UA } from "../constants";
import { getText } from "../http";
import { safePublicUrl, sentences, stripTags, tagText } from "../text";
import type { SourceRef } from "../types";

const PAGE_NOISE = /\b(sign in|get a demo|work email|first name|last name|subscribe|privacy policy|cookie|see all reviews|schedule a call|under attack|your work email)\b/i;

export type WebsiteExtract = {
  url: string;
  title?: string;
  description?: string;
  excerpt?: string;
  quotes: string[];
  source: SourceRef;
};

export function extractWebsite(html: string, url: string, retrievedAt: string): WebsiteExtract {
  const title = tagText(html, "title");
  const descriptionMatch = /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i.exec(html)
    ?? /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i.exec(html);
  const description = descriptionMatch ? stripTags(descriptionMatch[1]) : "";
  const text = stripTags(html);
  const fortune = /Trusted by[^.]{0,100}?Fortune\s*100(?:\s+companies)?/i.exec(text)?.[0]
    ?? /[^.]{0,40}Fortune\s*100[^.]{0,50}/i.exec(text)?.[0];
  const quotes = fortune ? [fortune.replace(/\s+/g, " ").trim()] : [];
  const body = sentences(text).filter((sentence) => (
    sentence.length >= 50
    && sentence.length <= 280
    && !PAGE_NOISE.test(sentence)
    && !/fortune\s*100/i.test(sentence)
  )).slice(0, 2);
  const excerpt = [description, ...body].filter(Boolean).join(" ").replace(/\s+/g, " ").trim().slice(0, 900);
  return {
    url,
    title: title || undefined,
    description: description || undefined,
    excerpt: excerpt || undefined,
    quotes,
    source: { name: "Company website", url, retrievedAt },
  };
}

export async function fetchWebsite(rawUrl: string, retrievedAt: string): Promise<{ site?: WebsiteExtract; error?: string }> {
  const url = safePublicUrl(rawUrl);
  if (!url) return { error: "The website URL is missing or is not a public http(s) address." };
  try {
    const response = await getText(url, {
      headers: { "User-Agent": BROWSER_UA, Accept: "text/html" },
      timeoutMs: 8000,
      cacheKey: `site:${url}`,
    });
    if (!response.ok) return { error: `The company site returned HTTP ${response.status}.` };
    const site = extractWebsite(response.text.slice(0, 1_500_000), response.finalUrl || url, retrievedAt);
    if (!site.excerpt && !site.quotes.length) {
      return { site, error: "The company site responded, but no readable product description was extracted." };
    }
    return { site };
  } catch {
    return { error: "The company site timed out or could not be fetched." };
  }
}
