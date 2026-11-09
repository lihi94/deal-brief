/**
 * Written screening rules. The stance comes from these gates, not from a model.
 * Thresholds are part of the rubric on purpose so a reader can re-apply them.
 */
export const RUBRIC = {
  /** Latest fiscal operating margin must clear this to be eligible for Attractive. */
  minOperatingMargin: 0.08,
  /** Market cap / last fiscal-year revenue must be at or below this for Attractive. */
  maxRevenueMultiple: 15,
  /** With negative equity and negative operating cash flow, this margin is a Pass. */
  distressOperatingMargin: -0.15,
} as const;

export const DISCLAIMER =
  "Deal Brief is a portfolio screening tool, not an investment adviser. A memo is not a recommendation to buy, sell, or hold any security. Figures are only as good as the cited sources, and missing data stays Unknown.";

export const TEMPLATE_NOTE =
  "Structured template, not live AI. Sentences are filled from the source pack. The stance comes from the written rubric, not from a model.";

export const SAMPLE_NOTE =
  "Checked-in sample captured from the cited sources. Not a live fetch. The stance comes from the written rubric, not from a model.";

export const EDGAR_UA_DEFAULT = "Deal Brief (lihi94) elihai94@gmail.com";

export const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

/** Public CIKs for the names this portfolio demo must resolve even if the ticker file is rate-limited. */
export const KNOWN_ISSUERS: { keys: string[]; ticker: string; cik: string; name: string }[] = [
  { keys: ["wix", "wix.com", "wix.com ltd", "wix.com ltd."], ticker: "WIX", cik: "0001576789", name: "Wix.com Ltd." },
  { keys: ["nvidia", "nvidia corp", "nvidia corporation", "nvda"], ticker: "NVDA", cik: "0001045810", name: "NVIDIA CORP" },
  { keys: ["nice", "nice ltd", "nice ltd."], ticker: "NICE", cik: "0001003935", name: "NICE Ltd." },
  {
    keys: ["teva", "teva pharmaceutical", "teva pharmaceutical industries", "teva pharmaceutical industries ltd"],
    ticker: "TEVA",
    cik: "0000818686",
    name: "TEVA PHARMACEUTICAL INDUSTRIES LTD",
  },
  { keys: ["monday", "monday.com", "monday.com ltd", "monday.com ltd.", "mndy"], ticker: "MNDY", cik: "0001845338", name: "monday.com Ltd." },
];
