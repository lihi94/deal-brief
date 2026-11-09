import type { Headline } from "../types";
import { tagText } from "../text";

export function parseRss(xml: string, limit = 4): Headline[] {
  const headlines: Headline[] = [];
  for (const block of xml.split(/<item\b/i).slice(1)) {
    const title = tagText(block, "title");
    const link = tagText(block, "link") || tagText(block, "guid");
    if (!title || title.length < 8) continue;
    headlines.push({
      title,
      url: link,
      source: tagText(block, "source") || undefined,
      published: tagText(block, "pubDate") || undefined,
    });
    if (headlines.length >= limit) break;
  }
  return headlines;
}
