import { EDGAR_UA_DEFAULT } from "../constants";
import { getText } from "../http";
import type { AnnualFact, FiscalSeries, SourceRef } from "../types";

const ANNUAL_FORMS = new Set(["10-K", "10-K/A", "20-F", "20-F/A", "40-F", "40-F/A"]);

const FLOW_CONCEPTS = {
  revenue: [
    "RevenueFromContractWithCustomerExcludingAssessedTax",
    "Revenues",
    "SalesRevenueNet",
    "Revenue",
  ],
  grossProfit: ["GrossProfit"],
  operatingIncome: ["OperatingIncomeLoss", "ProfitLossFromOperatingActivities"],
  netIncome: ["NetIncomeLoss", "ProfitLoss"],
  operatingCashFlow: ["NetCashProvidedByUsedInOperatingActivities", "CashFlowsFromUsedInOperatingActivities"],
} as const;

const STOCK_CONCEPTS = {
  equity: ["StockholdersEquity", "EquityAttributableToOwnersOfParent", "Equity"],
} as const;

type FactRow = {
  start?: string;
  end?: string;
  val?: number;
  accn?: string;
  fy?: number;
  fp?: string;
  form?: string;
  filed?: string;
};

export type EdgarCompany = {
  cik: string;
  name?: string;
  tickers: string[];
  exchanges: string[];
  sic?: string;
  sicDescription?: string;
  fiscal: FiscalSeries;
  sources: SourceRef[];
};

type DirectoryEntry = { cik: string; ticker: string; title: string };

let directoryCache: { expires: number; entries: DirectoryEntry[] } | null = null;

export function edgarUserAgent(): string {
  return process.env.EDGAR_USER_AGENT?.trim() || EDGAR_UA_DEFAULT;
}

function padCik(cik: string | number): string {
  return String(cik).replace(/\D/g, "").padStart(10, "0");
}

function daysBetween(start?: string, end?: string): number | null {
  if (!start || !end) return null;
  const from = Date.parse(`${start}T00:00:00Z`);
  const to = Date.parse(`${end}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to)) return null;
  return Math.round((to - from) / 86_400_000);
}

function annualRows(rows: FactRow[], instant: boolean): FactRow[] {
  const best = new Map<string, FactRow>();
  for (const row of rows) {
    if (!row.end || typeof row.val !== "number" || !ANNUAL_FORMS.has(row.form ?? "")) continue;
    if (row.fp && row.fp !== "FY") continue;
    const span = daysBetween(row.start, row.end);
    if (instant) {
      if (span != null && span > 5) continue;
    } else if (span == null || span < 300 || span > 380) {
      continue;
    }
    const current = best.get(row.end);
    if (!current || (row.filed ?? "") >= (current.filed ?? "")) best.set(row.end, row);
  }
  return [...best.values()].sort((a, b) => (a.end ?? "").localeCompare(b.end ?? ""));
}

function seriesFromConcept(
  facts: Record<string, { units?: Record<string, FactRow[]> }>,
  taxonomy: string,
  concept: string,
  instant: boolean,
): AnnualFact[] {
  const units = facts[concept]?.units?.USD;
  if (!units) return [];
  return annualRows(units, instant).map((row) => ({
    concept,
    taxonomy,
    end: row.end ?? "",
    filed: row.filed ?? "",
    form: row.form ?? "",
    value: row.val ?? 0,
    accn: row.accn,
    unit: "USD",
  }));
}

function chooseSeries(
  taxonomies: Record<string, Record<string, { units?: Record<string, FactRow[]> }>>,
  concepts: readonly string[],
  instant: boolean,
): AnnualFact[] | undefined {
  let best: AnnualFact[] | undefined;
  for (const concept of concepts) {
    for (const taxonomy of ["us-gaap", "ifrs-full"]) {
      const series = seriesFromConcept(taxonomies[taxonomy] ?? {}, taxonomy, concept, instant);
      if (!series.length) continue;
      const end = series[series.length - 1]?.end ?? "";
      const bestEnd = best?.[best.length - 1]?.end ?? "";
      if (!best || end > bestEnd) best = series;
    }
  }
  return best;
}

export function parseCompanyFacts(payload: unknown): FiscalSeries {
  const facts = (payload as { facts?: Record<string, Record<string, { units?: Record<string, FactRow[]> }>> })?.facts ?? {};
  const fiscal: FiscalSeries = {};
  for (const [key, concepts] of Object.entries(FLOW_CONCEPTS)) {
    const series = chooseSeries(facts, concepts, false);
    if (series) fiscal[key as keyof typeof FLOW_CONCEPTS] = series;
  }
  for (const [key, concepts] of Object.entries(STOCK_CONCEPTS)) {
    const series = chooseSeries(facts, concepts, true);
    if (series) fiscal[key as keyof typeof STOCK_CONCEPTS] = series;
  }
  return fiscal;
}

export function parseSubmissions(payload: unknown, cik: string): Omit<EdgarCompany, "fiscal" | "sources"> {
  const record = (payload ?? {}) as {
    name?: string;
    tickers?: string[];
    exchanges?: string[];
    sic?: string;
    sicDescription?: string;
  };
  return {
    cik,
    name: record.name,
    tickers: record.tickers ?? [],
    exchanges: record.exchanges ?? [],
    sic: record.sic,
    sicDescription: record.sicDescription,
  };
}

export function parseTickerDirectory(payload: unknown): DirectoryEntry[] {
  if (!payload || typeof payload !== "object") return [];
  return Object.values(payload as Record<string, { cik_str?: number; ticker?: string; title?: string }>)
    .filter((entry) => entry.ticker && entry.title && entry.cik_str)
    .map((entry) => ({
      cik: padCik(entry.cik_str ?? ""),
      ticker: String(entry.ticker).toUpperCase(),
      title: String(entry.title),
    }));
}

export async function loadTickerDirectory(retrievedAt: string): Promise<{ entries: DirectoryEntry[]; source?: SourceRef; error?: string }> {
  if (directoryCache && directoryCache.expires > Date.now()) {
    return {
      entries: directoryCache.entries,
      source: {
        name: "SEC company tickers",
        url: "https://www.sec.gov/files/company_tickers.json",
        retrievedAt,
      },
    };
  }
  try {
    const response = await getText("https://www.sec.gov/files/company_tickers.json", {
      headers: { "User-Agent": edgarUserAgent(), Accept: "application/json" },
      timeoutMs: 20000,
      ttlMs: 12 * 60 * 60 * 1000,
    });
    if (!response.ok) return { entries: [], error: `SEC ticker file returned HTTP ${response.status}.` };
    const entries = parseTickerDirectory(JSON.parse(response.text) as unknown);
    directoryCache = { entries, expires: Date.now() + 12 * 60 * 60 * 1000 };
    return {
      entries,
      source: { name: "SEC company tickers", url: "https://www.sec.gov/files/company_tickers.json", retrievedAt },
    };
  } catch {
    return { entries: [], error: "SEC ticker file timed out or could not be read." };
  }
}

export async function fetchEdgarCompany(cik: string, retrievedAt: string): Promise<{ company?: EdgarCompany; error?: string }> {
  const padded = padCik(cik);
  const headers = { "User-Agent": edgarUserAgent(), Accept: "application/json" };
  const submissionsUrl = `https://data.sec.gov/submissions/CIK${padded}.json`;
  const factsUrl = `https://data.sec.gov/api/xbrl/companyfacts/CIK${padded}.json`;
  try {
    const [submissions, facts] = await Promise.all([
      getText(submissionsUrl, { headers, timeoutMs: 15000, cacheKey: `sec-sub:${padded}` }),
      getText(factsUrl, { headers, timeoutMs: 20000, cacheKey: `sec-facts:${padded}` }),
    ]);
    if (!submissions.ok && !facts.ok) {
      return { error: `SEC EDGAR returned HTTP ${submissions.status} / ${facts.status} for CIK ${padded}.` };
    }
    const identity = submissions.ok
      ? parseSubmissions(JSON.parse(submissions.text) as unknown, padded)
      : { cik: padded, tickers: [], exchanges: [] };
    const fiscal = facts.ok ? parseCompanyFacts(JSON.parse(facts.text) as unknown) : {};
    const sources: SourceRef[] = [];
    if (submissions.ok) sources.push({ name: "SEC EDGAR submissions", url: submissionsUrl, retrievedAt });
    if (facts.ok) sources.push({ name: "SEC EDGAR company facts", url: factsUrl, retrievedAt });
    return { company: { ...identity, fiscal, sources } };
  } catch {
    return { error: `SEC EDGAR timed out for CIK ${padded}.` };
  }
}

export function filingIndexUrl(cik: string, accn: string | undefined): string | undefined {
  if (!accn) return undefined;
  const digits = accn.replace(/\D/g, "");
  const numericCik = String(Number(cik.replace(/\D/g, "")));
  if (!digits || !numericCik) return undefined;
  return `https://www.sec.gov/Archives/edgar/data/${numericCik}/${digits}/${accn}-index.html`;
}
