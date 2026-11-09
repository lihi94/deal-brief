export type Track = "public" | "startup";

export type Conviction = "high" | "medium" | "low";

export type PublicStance = "Attractive" | "Watch" | "Pass";

export type StartupStance = "Diligence further" | "Pass" | "Need more information";

export type Stance = PublicStance | StartupStance;

export type GenerationMode = "sample" | "template" | "live-ai";

export type SourceRef = {
  name: string;
  url: string;
  retrievedAt: string;
};

export type Headline = {
  title: string;
  url: string;
  source?: string;
  published?: string;
};

export type AnnualFact = {
  concept: string;
  taxonomy: string;
  end: string;
  filed: string;
  form: string;
  value: number;
  accn?: string;
  unit: string;
};

export type FiscalSeries = {
  revenue?: AnnualFact[];
  grossProfit?: AnnualFact[];
  operatingIncome?: AnnualFact[];
  netIncome?: AnnualFact[];
  operatingCashFlow?: AnnualFact[];
  equity?: AnnualFact[];
};

export type TrailingQuote = {
  revenue?: number;
  grossMargin?: number;
  operatingMargin?: number;
  profitMargin?: number;
  operatingCashFlow?: number;
  freeCashFlow?: number;
  totalCash?: number;
  totalDebt?: number;
  trailingEps?: number;
  mostRecentQuarter?: string;
};

export type PublicContext = {
  track: "public";
  query: string;
  resolved: boolean;
  companyName?: string;
  ticker?: string;
  cik?: string;
  exchange?: string;
  sector?: string;
  industry?: string;
  sic?: string;
  website?: string;
  businessSummary?: string;
  employees?: number;
  currency?: string;
  price?: number;
  priceTime?: string;
  marketCap?: number;
  enterpriseValue?: number;
  sharesOutstanding?: number;
  bookValuePerShare?: number;
  fiscal: FiscalSeries;
  trailing: TrailingQuote;
  headlines: Headline[];
  errors: string[];
  sources: SourceRef[];
};

export type StartupContext = {
  track: "startup";
  query: string;
  websiteUrl?: string;
  /** User-supplied. Never a source. Never an input to the stance. */
  notes?: string;
  siteTitle?: string;
  siteExcerpt?: string;
  siteQuotes: string[];
  headlines: Headline[];
  coverageNote?: string;
  errors: string[];
  sources: SourceRef[];
};

export type ResearchContext = PublicContext | StartupContext;

export type Judgment = {
  stance: Stance;
  conviction: Conviction;
  rationale: string;
  drivers: string[];
  blockers: string[];
};

export type MemoTable = {
  caption: string;
  columns: string[];
  rows: string[][];
};

export type MemoSection = {
  id: string;
  heading: string;
  paragraphs: string[];
  numbered?: string[];
  bullets?: string[];
  quotes?: { text: string; note: string }[];
  table?: MemoTable;
  /** Rendered after the table and lists. */
  footer?: string[];
};

export type Memo = {
  id: string;
  track: Track;
  subject: string;
  ticker?: string;
  generatedAt: string;
  stance: Stance;
  conviction: Conviction;
  stanceRationale: string;
  drivers: string[];
  sections: MemoSection[];
  sources: SourceRef[];
  generationMode: GenerationMode;
  generationNote: string;
  model?: string;
  disclaimer: string;
  markdown: string;
};

export type GenerateInput = {
  track: Track;
  query: string;
  website?: string;
  notes?: string;
};
