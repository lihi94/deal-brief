import { BROWSER_UA } from "../constants";
import { unixSecondsToIso } from "../format";
import { getText } from "../http";
import type { SourceRef, TrailingQuote } from "../types";

export type YahooQuote = {
  ticker: string;
  companyName?: string;
  exchange?: string;
  currency?: string;
  sector?: string;
  industry?: string;
  website?: string;
  businessSummary?: string;
  employees?: number;
  price?: number;
  priceTime?: string;
  marketCap?: number;
  enterpriseValue?: number;
  sharesOutstanding?: number;
  bookValuePerShare?: number;
  trailing: TrailingQuote;
  source: SourceRef;
  via: "quoteSummary" | "chart";
};

type YahooRaw = { raw?: number; fmt?: string };

let crumbCache: { cookie: string; crumb: string; expires: number } | null = null;

function rawNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value && typeof value === "object" && "raw" in value && typeof (value as YahooRaw).raw === "number") {
    return (value as YahooRaw).raw;
  }
  return undefined;
}

async function getCrumb(): Promise<{ cookie: string; crumb: string } | null> {
  if (crumbCache && crumbCache.expires > Date.now()) return crumbCache;
  try {
    const seed = await fetch("https://fc.yahoo.com", {
      headers: { "User-Agent": BROWSER_UA },
      redirect: "manual",
      signal: AbortSignal.timeout(8000),
    });
    const setCookie = typeof seed.headers.getSetCookie === "function" ? seed.headers.getSetCookie() : [];
    const cookie = setCookie.map((entry) => entry.split(";")[0]).join("; ");
    if (!cookie) return null;
    const crumbResponse = await fetch("https://query1.finance.yahoo.com/v1/test/getcrumb", {
      headers: { "User-Agent": BROWSER_UA, Cookie: cookie },
      signal: AbortSignal.timeout(8000),
    });
    const crumb = (await crumbResponse.text()).trim();
    if (!crumbResponse.ok || !crumb || crumb.includes("{") || crumb.length > 32) return null;
    crumbCache = { cookie, crumb, expires: Date.now() + 30 * 60 * 1000 };
    return crumbCache;
  } catch {
    return null;
  }
}

export function parseQuoteSummary(payload: unknown, retrievedAt: string): YahooQuote | null {
  if (!payload || typeof payload !== "object") return null;
  const result = (payload as { quoteSummary?: { result?: unknown[] } }).quoteSummary?.result?.[0];
  if (!result || typeof result !== "object") return null;
  const record = result as {
    price?: Record<string, unknown>;
    summaryProfile?: Record<string, unknown>;
    financialData?: Record<string, unknown>;
    defaultKeyStatistics?: Record<string, unknown>;
  };
  const price = record.price ?? {};
  const profile = record.summaryProfile ?? {};
  const financials = record.financialData ?? {};
  const stats = record.defaultKeyStatistics ?? {};
  const ticker = typeof price.symbol === "string" ? price.symbol : undefined;
  if (!ticker) return null;
  const priceTime = rawNumber(price.regularMarketTime);
  const quarter = rawNumber(stats.mostRecentQuarter);
  const summary = typeof profile.longBusinessSummary === "string" ? profile.longBusinessSummary.trim() : undefined;
  return {
    ticker,
    companyName: stringField(price.longName) ?? stringField(price.shortName),
    exchange: stringField(price.exchangeName),
    currency: stringField(price.currency),
    sector: stringField(profile.sector),
    industry: stringField(profile.industry),
    website: stringField(profile.website),
    businessSummary: summary || undefined,
    employees: rawNumber(profile.fullTimeEmployees),
    price: rawNumber(price.regularMarketPrice),
    priceTime: priceTime ? unixSecondsToIso(priceTime) : undefined,
    marketCap: rawNumber(price.marketCap),
    enterpriseValue: rawNumber(stats.enterpriseValue),
    sharesOutstanding: rawNumber(stats.sharesOutstanding),
    bookValuePerShare: rawNumber(stats.bookValue),
    trailing: {
      revenue: rawNumber(financials.totalRevenue),
      grossMargin: rawNumber(financials.grossMargins),
      operatingMargin: rawNumber(financials.operatingMargins),
      profitMargin: rawNumber(financials.profitMargins),
      operatingCashFlow: rawNumber(financials.operatingCashflow),
      freeCashFlow: rawNumber(financials.freeCashflow),
      totalCash: rawNumber(financials.totalCash),
      totalDebt: rawNumber(financials.totalDebt),
      trailingEps: rawNumber(stats.trailingEps),
      mostRecentQuarter: quarter ? unixSecondsToIso(quarter).slice(0, 10) : undefined,
    },
    source: {
      name: "Yahoo Finance quoteSummary",
      url: `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ticker)}?modules=price,summaryProfile,financialData,defaultKeyStatistics`,
      retrievedAt,
    },
    via: "quoteSummary",
  };
}

export function parseChart(payload: unknown, ticker: string, retrievedAt: string): YahooQuote | null {
  if (!payload || typeof payload !== "object") return null;
  const meta = (payload as { chart?: { result?: { meta?: Record<string, unknown> }[] } }).chart?.result?.[0]?.meta;
  if (!meta) return null;
  const symbol = stringField(meta.symbol) ?? ticker;
  const priceTime = typeof meta.regularMarketTime === "number" ? meta.regularMarketTime : undefined;
  return {
    ticker: symbol,
    companyName: stringField(meta.longName) ?? stringField(meta.shortName),
    exchange: stringField(meta.fullExchangeName) ?? stringField(meta.exchangeName),
    currency: stringField(meta.currency),
    price: typeof meta.regularMarketPrice === "number" ? meta.regularMarketPrice : undefined,
    priceTime: priceTime ? unixSecondsToIso(priceTime) : undefined,
    trailing: {},
    source: {
      name: "Yahoo Finance chart",
      url: `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`,
      retrievedAt,
    },
    via: "chart",
  };
}

function stringField(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export async function fetchYahooQuote(ticker: string, retrievedAt: string): Promise<YahooQuote | null> {
  const symbol = ticker.trim().toUpperCase();
  if (!/^[A-Z0-9.\-]{1,10}$/.test(symbol)) return null;
  const crumb = await getCrumb();
  if (crumb) {
    try {
      const url = new URL(`https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}`);
      url.searchParams.set("modules", "price,summaryProfile,financialData,defaultKeyStatistics");
      url.searchParams.set("crumb", crumb.crumb);
      const response = await getText(url.toString(), {
        headers: { "User-Agent": BROWSER_UA, Cookie: crumb.cookie },
        timeoutMs: 12000,
        cacheKey: `yahoo-qs:${symbol}`,
      });
      if (response.ok) {
        const parsed = parseQuoteSummary(JSON.parse(response.text) as unknown, retrievedAt);
        if (parsed?.price != null || parsed?.marketCap != null) return parsed;
      }
    } catch {
      // Fall through to the chart endpoint, which does not need a crumb.
    }
  }

  try {
    const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
    const chart = await getText(chartUrl, {
      headers: { "User-Agent": BROWSER_UA },
      cacheKey: `yahoo-chart:${symbol}`,
    });
    if (!chart.ok) return null;
    return parseChart(JSON.parse(chart.text) as unknown, symbol, retrievedAt);
  } catch {
    return null;
  }
}
