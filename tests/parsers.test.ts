import { describe, expect, it } from "vitest";
import { parseCompanyFacts } from "../lib/sources/edgar";
import { parseRss } from "../lib/sources/rss";
import { extractWebsite } from "../lib/sources/website";
import { parseChart, parseQuoteSummary } from "../lib/sources/yahoo";

describe("parsers", () => {
  it("keeps the latest full-year revenue concept and ignores a stale one", () => {
    const fiscal = parseCompanyFacts({
      facts: {
        "us-gaap": {
          RevenueFromContractWithCustomerExcludingAssessedTax: {
            units: {
              USD: [
                { start: "2021-02-01", end: "2022-01-30", val: 100, form: "10-K", fp: "FY", filed: "2022-03-01" },
              ],
            },
          },
          Revenues: {
            units: {
              USD: [
                { start: "2025-01-27", end: "2026-01-25", val: 215_938_000_000, form: "10-K", fp: "FY", filed: "2026-02-25", accn: "0001045810-26-000021" },
                { start: "2025-10-27", end: "2026-01-25", val: 50, form: "10-K", fp: "Q4", filed: "2026-02-25" },
              ],
            },
          },
          OperatingIncomeLoss: {
            units: {
              USD: [{ start: "2025-01-27", end: "2026-01-25", val: 130_387_000_000, form: "10-K", fp: "FY", filed: "2026-02-25" }],
            },
          },
          StockholdersEquity: {
            units: {
              USD: [{ end: "2026-01-25", val: 157_293_000_000, form: "10-K", fp: "FY", filed: "2026-02-25" }],
            },
          },
        },
      },
    });
    expect(fiscal.revenue?.[0]?.value).toBe(215_938_000_000);
    expect(fiscal.revenue?.[0]?.concept).toBe("Revenues");
    expect(fiscal.operatingIncome?.[0]?.value).toBe(130_387_000_000);
    expect(fiscal.equity?.[0]?.value).toBe(157_293_000_000);
  });

  it("reads a quoteSummary market cap and ignores a blocked payload", () => {
    const quote = parseQuoteSummary({
      quoteSummary: {
        result: [{
          price: {
            symbol: "NVDA",
            longName: "NVIDIA Corporation",
            regularMarketPrice: { raw: 177.16 },
            regularMarketTime: { raw: 1794235755 },
            marketCap: { raw: 4_278_002_909_184 },
            currency: "USD",
          },
          summaryProfile: { sector: "Technology", longBusinessSummary: "NVIDIA Corporation operates as a data center company." },
          financialData: { operatingMargins: { raw: 0.66237 }, totalRevenue: { raw: 302_970_011_648 } },
          defaultKeyStatistics: {},
        }],
      },
    }, "2026-11-09T15:00:00.000Z");
    expect(quote?.marketCap).toBe(4_278_002_909_184);
    expect(quote?.trailing.operatingMargin).toBeCloseTo(0.66237);
    expect(parseQuoteSummary({ finance: { error: { code: "Unauthorized" } } }, "2026-11-09T15:00:00.000Z")).toBeNull();
  });

  it("reads a chart quote when summary statistics are unavailable", () => {
    const quote = parseChart({
      chart: { result: [{ meta: { symbol: "WIX", longName: "Wix.com Ltd.", regularMarketPrice: 75.98, currency: "USD", fullExchangeName: "NasdaqGS" } }] },
    }, "WIX", "2026-11-09T15:00:00.000Z");
    expect(quote?.price).toBe(75.98);
    expect(quote?.via).toBe("chart");
    expect(quote?.marketCap).toBeUndefined();
  });

  it("parses a few RSS headlines and quotes a Fortune 100 sentence from a site", () => {
    const headlines = parseRss(`<?xml version="1.0"?><rss><channel><item><title>NVIDIA updates its platform</title><link>https://news.example/nvda</link><pubDate>Mon, 09 Nov 2026</pubDate><source>Example</source></item></channel></rss>`);
    expect(headlines[0]?.title).toBe("NVIDIA updates its platform");
    const site = extractWebsite(
      `<html><head><title>Wiz | Cloud security</title><meta name="description" content="Cloud security platform."></head><body><p>Trusted by more than 65% of Fortune 100 companies.</p><p>Wiz connects code, cloud, and runtime into a single security graph that provides context for security teams.</p></body></html>`,
      "https://www.wiz.io/",
      "2026-11-09T15:00:00.000Z",
    );
    expect(site.quotes[0]).toContain("Fortune 100");
    expect(site.excerpt).toContain("security graph");
  });
});
