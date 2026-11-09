import { KNOWN_ISSUERS } from "./constants";
import { fetchEdgarCompany, loadTickerDirectory } from "./sources/edgar";
import { fetchHeadlines } from "./sources/news";
import { fetchWebsite } from "./sources/website";
import { fetchYahooQuote } from "./sources/yahoo";
import { normalizeName, safePublicUrl } from "./text";
import type { GenerateInput, PublicContext, ResearchContext, StartupContext } from "./types";

type IssuerHit = { ticker: string; cik: string; name: string };

function knownIssuer(query: string): IssuerHit | undefined {
  const key = normalizeName(query);
  return KNOWN_ISSUERS.find((issuer) => issuer.keys.includes(key));
}

function searchDirectory(entries: { cik: string; ticker: string; title: string }[], query: string): IssuerHit | undefined {
  const key = normalizeName(query);
  if (!key) return undefined;
  const exactTicker = entries.find((entry) => entry.ticker.toLowerCase() === key);
  if (exactTicker) return { ticker: exactTicker.ticker, cik: exactTicker.cik, name: exactTicker.title };
  const exactTitle = entries.find((entry) => normalizeName(entry.title) === key);
  if (exactTitle) return { ticker: exactTitle.ticker, cik: exactTitle.cik, name: exactTitle.title };
  const contains = entries.filter((entry) => normalizeName(entry.title).includes(key) || key.includes(normalizeName(entry.title)));
  contains.sort((a, b) => a.title.length - b.title.length);
  const hit = contains[0];
  return hit ? { ticker: hit.ticker, cik: hit.cik, name: hit.title } : undefined;
}

export async function gather(input: GenerateInput, now = new Date()): Promise<ResearchContext> {
  const retrievedAt = now.toISOString();
  if (input.track === "startup") return gatherStartup(input, retrievedAt);
  return gatherPublic(input, retrievedAt);
}

async function gatherPublic(input: GenerateInput, retrievedAt: string): Promise<PublicContext> {
  const query = input.query.trim().replace(/\s+/g, " ").slice(0, 80);
  const errors: string[] = [];
  const tickerGuess = /^[A-Za-z][A-Za-z0-9.\-]{0,9}$/.test(query) ? query.toUpperCase() : undefined;
  const alias = knownIssuer(query);

  const [directory, firstQuote] = await Promise.all([
    loadTickerDirectory(retrievedAt),
    tickerGuess ? fetchYahooQuote(tickerGuess, retrievedAt) : Promise.resolve(null),
  ]);
  if (directory.error) errors.push(directory.error);

  const fromDirectory = searchDirectory(directory.entries, alias?.ticker ?? query) ?? (alias ? searchDirectory(directory.entries, alias.name) : undefined);
  const hit = fromDirectory ?? alias;
  const ticker = firstQuote?.ticker ?? hit?.ticker ?? tickerGuess;
  const quote = firstQuote ?? (ticker ? await fetchYahooQuote(ticker, retrievedAt) : null);
  if (!quote) errors.push(ticker ? `No Yahoo Finance quote for ${ticker}.` : "No ticker to quote.");

  const edgar = hit?.cik ? await fetchEdgarCompany(hit.cik, retrievedAt) : { error: undefined as string | undefined, company: undefined };
  if (edgar.error) errors.push(edgar.error);

  const name = quote?.companyName ?? edgar.company?.name ?? hit?.name;
  const news = await fetchHeadlines(name ?? query, retrievedAt, { ticker });
  errors.push(...news.errors);

  const sources = [
    ...(directory.source && hit ? [directory.source] : []),
    ...(quote ? [quote.source] : []),
    ...(edgar.company?.sources ?? []),
    ...news.sources,
  ];

  return {
    track: "public",
    query,
    resolved: Boolean(quote || edgar.company || hit),
    companyName: name,
    ticker,
    cik: hit?.cik ?? edgar.company?.cik,
    exchange: quote?.exchange ?? edgar.company?.exchanges?.[0],
    sector: quote?.sector,
    industry: quote?.industry,
    sic: edgar.company?.sicDescription
      ? `${edgar.company.sic ?? ""} ${edgar.company.sicDescription}`.trim()
      : undefined,
    website: quote?.website,
    businessSummary: quote?.businessSummary,
    employees: quote?.employees,
    currency: quote?.currency,
    price: quote?.price,
    priceTime: quote?.priceTime,
    marketCap: quote?.marketCap,
    enterpriseValue: quote?.enterpriseValue,
    sharesOutstanding: quote?.sharesOutstanding,
    bookValuePerShare: quote?.bookValuePerShare,
    fiscal: edgar.company?.fiscal ?? {},
    trailing: quote?.trailing ?? {},
    headlines: news.headlines,
    errors,
    sources,
  };
}

async function gatherStartup(input: GenerateInput, retrievedAt: string): Promise<StartupContext> {
  const query = input.query.trim().replace(/\s+/g, " ").slice(0, 80);
  const websiteUrl = safePublicUrl(input.website);
  const notes = input.notes?.trim().slice(0, 2000) || undefined;
  const errors: string[] = [];
  if (input.website?.trim() && !websiteUrl) errors.push("The website was ignored because it is not a public http(s) URL.");

  const host = websiteUrl ? new URL(websiteUrl).hostname.replace(/^www\./, "") : "";
  const [siteResult, news] = await Promise.all([
    websiteUrl ? fetchWebsite(websiteUrl, retrievedAt) : Promise.resolve({ site: undefined, error: undefined as string | undefined }),
    fetchHeadlines(host || query, retrievedAt),
  ]);
  if (siteResult.error) errors.push(siteResult.error);
  errors.push(...news.errors);

  const site = siteResult.site;
  const independentHeadlines = news.headlines.filter((headline) => {
    const blob = `${headline.source ?? ""} ${headline.url}`.toLowerCase();
    return host ? !blob.includes(host) : true;
  });
  const coverageNote = independentHeadlines.length === 0
    ? `Independent press coverage in this pull is thin. ${news.headlines.length === 0 ? "No headlines were retrieved." : "The headlines that came back are from the company site itself, so they are not outside coverage."}`
    : news.headlines.length < 2
      ? `Public headline coverage in this pull is thin (${news.headlines.length} item${news.headlines.length === 1 ? "" : "s"}).`
      : undefined;

  return {
    track: "startup",
    query,
    websiteUrl: site?.url ?? websiteUrl,
    notes,
    siteTitle: site?.title,
    siteExcerpt: site?.excerpt,
    siteQuotes: site?.quotes ?? [],
    headlines: news.headlines,
    coverageNote,
    errors,
    sources: [...(site ? [site.source] : []), ...news.sources],
  };
}
