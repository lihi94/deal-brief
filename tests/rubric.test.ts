import { describe, expect, it } from "vitest";
import { buildMemo } from "../lib/memo";
import { judge, ratio } from "../lib/rubric";
import type { AnnualFact, PublicContext, StartupContext } from "../lib/types";

function fact(end: string, value: number, concept: string): AnnualFact {
  return { concept, taxonomy: "us-gaap", end, filed: "2026-03-05", form: "20-F", value, unit: "USD" };
}

function publicContext(overrides: Partial<PublicContext> = {}): PublicContext {
  const base: PublicContext = {
    track: "public",
    query: "TEST",
    resolved: true,
    companyName: "Test Corp",
    ticker: "TEST",
    sector: "Technology",
    industry: "Software",
    businessSummary: "Test Corp sells software to businesses in several countries.",
    currency: "USD",
    price: 50,
    priceTime: "2026-11-09T14:00:00.000Z",
    marketCap: 8_000_000_000,
    fiscal: {
      revenue: [fact("2024-12-31", 800_000_000, "Revenues"), fact("2025-12-31", 1_000_000_000, "Revenues")],
      grossProfit: [fact("2025-12-31", 700_000_000, "GrossProfit")],
      operatingIncome: [fact("2024-12-31", 200_000_000, "OperatingIncomeLoss"), fact("2025-12-31", 200_000_000, "OperatingIncomeLoss")],
      operatingCashFlow: [fact("2025-12-31", 180_000_000, "NetCashProvidedByUsedInOperatingActivities")],
      equity: [fact("2025-12-31", 400_000_000, "StockholdersEquity")],
    },
    trailing: {},
    headlines: [],
    errors: [],
    sources: [{ name: "Fixture", url: "https://example.com/fixture", retrievedAt: "2026-11-09T14:00:00.000Z" }],
  };
  return {
    ...base,
    ...overrides,
    fiscal: overrides.fiscal ?? base.fiscal,
    trailing: overrides.trailing ?? base.trailing,
    headlines: overrides.headlines ?? base.headlines,
    errors: overrides.errors ?? base.errors,
    sources: overrides.sources ?? base.sources,
  };
}

describe("public rubric", () => {
  it("rates a clean, reasonably priced filing Attractive", () => {
    const judgment = judge(publicContext());
    expect(judgment.stance).toBe("Attractive");
    expect(judgment.conviction).toBe("high");
    expect(ratio(8_000_000_000, 1_000_000_000)).toBe(8);
  });

  it("refuses Attractive for Wix-like margin collapse and negative equity, and stays Watch", () => {
    const context = publicContext({
      companyName: "Wix.com Ltd.",
      ticker: "WIX",
      marketCap: 3_180_000_000,
      fiscal: {
        revenue: [fact("2024-12-31", 1_760_650_000, "Revenues"), fact("2025-12-31", 1_993_044_000, "Revenues")],
        grossProfit: [fact("2025-12-31", 1_356_691_000, "GrossProfit")],
        operatingIncome: [fact("2024-12-31", 100_141_000, "OperatingIncomeLoss"), fact("2025-12-31", 1_752_000, "OperatingIncomeLoss")],
        operatingCashFlow: [fact("2025-12-31", 582_858_000, "NetCashProvidedByUsedInOperatingActivities")],
        equity: [fact("2025-12-31", -366_002_000, "StockholdersEquity")],
      },
    });
    const judgment = judge(context);
    expect(judgment.stance).toBe("Watch");
    expect(judgment.conviction).toBe("high");
    expect(judgment.rationale.toLowerCase()).not.toContain("attractive is granted");
    const memo = buildMemo(context, judgment, { now: new Date("2026-11-09T15:00:00.000Z"), mode: "template" });
    expect(memo.stance).toBe("Watch");
    expect(memo.markdown).toContain("0.09%");
    expect(memo.markdown).toContain("Unknown");
    expect(memo.markdown).not.toContain("DCF value is $");
    expect(memo.generationNote.toLowerCase()).toContain("not live ai");
    expect(memo.sections.map((section) => section.heading)).toEqual([
      "Snapshot",
      "Business",
      "Investment thesis",
      "What would change my mind",
      "Financial highlights",
      "Valuation context",
      "Key risks",
      "Bottom line",
    ]);
  });

  it("refuses Attractive when the revenue multiple is above 15×, including a 19.81× NVIDIA-like case", () => {
    const revenue = 215_938_000_000;
    const marketCap = 4_278_002_909_184;
    const context = publicContext({
      companyName: "NVIDIA Corporation",
      ticker: "NVDA",
      marketCap,
      price: 177.16,
      fiscal: {
        revenue: [{ ...fact("2026-01-25", revenue, "Revenues"), form: "10-K", filed: "2026-02-25" }],
        grossProfit: [{ ...fact("2026-01-25", 153_463_000_000, "GrossProfit"), form: "10-K" }],
        operatingIncome: [{ ...fact("2026-01-25", 130_387_000_000, "OperatingIncomeLoss"), form: "10-K" }],
        operatingCashFlow: [{ ...fact("2026-01-25", 102_718_000_000, "NetCashProvidedByUsedInOperatingActivities"), form: "10-K" }],
        equity: [{ ...fact("2026-01-25", 157_293_000_000, "StockholdersEquity"), form: "10-K" }],
      },
    });
    const multiple = marketCap / revenue;
    expect(multiple).toBeGreaterThan(15);
    expect(multiple).toBeCloseTo(19.81, 1);
    const judgment = judge(context);
    expect(judgment.stance).toBe("Watch");
    expect(judgment.conviction).toBe("high");
    const memo = buildMemo(context, judgment, { now: new Date("2026-11-09T15:00:00.000Z") });
    expect(memo.markdown).toContain("15×");
    expect(memo.markdown.toLowerCase()).not.toContain("discounted cash flow of");
  });

  it("passes a distressed filing and passes an unresolved name", () => {
    const distressed = judge(publicContext({
      fiscal: {
        revenue: [fact("2025-12-31", 100_000_000, "Revenues")],
        operatingIncome: [fact("2025-12-31", -40_000_000, "OperatingIncomeLoss")],
        operatingCashFlow: [fact("2025-12-31", -10_000_000, "NetCashProvidedByUsedInOperatingActivities")],
        equity: [fact("2025-12-31", -5_000_000, "StockholdersEquity")],
      },
    }));
    expect(distressed.stance).toBe("Pass");
    expect(distressed.conviction).toBe("high");

    const empty = judge(publicContext({
      resolved: false,
      companyName: undefined,
      businessSummary: undefined,
      price: undefined,
      marketCap: undefined,
      fiscal: {},
    }));
    expect(empty.stance).toBe("Pass");
  });
});

describe("startup rubric", () => {
  const site = "Wiz connects code, cloud, and runtime into a single security graph that gives security teams context. The product is aimed at cloud and AI applications.";

  it("sends a described company to diligence and leaves funding unknown", () => {
    const context: StartupContext = {
      track: "startup",
      query: "Wiz",
      websiteUrl: "https://www.wiz.io/",
      siteExcerpt: site,
      siteQuotes: ["Trusted by more than 65% of Fortune 100 companies"],
      headlines: [],
      errors: [],
      sources: [{ name: "Company website", url: "https://www.wiz.io/", retrievedAt: "2026-11-09T15:00:00.000Z" }],
      notes: "They raised $100 million at a $2 billion valuation and have 500 employees.",
    };
    const judgment = judge(context);
    expect(judgment.stance).toBe("Diligence further");
    const memo = buildMemo(context, judgment, { now: new Date("2026-11-09T15:00:00.000Z") });
    expect(memo.markdown).toContain("Fortune 100");
    expect(memo.markdown).toContain("Funding: Unknown");
    expect(memo.markdown).toContain("Headcount: Unknown");
    expect(memo.markdown).toContain("Valuation: Unknown");
    expect(memo.markdown).toContain("Unverified");
    expect(memo.markdown).toContain("$100 million");
    const traction = memo.sections.find((section) => section.id === "traction")?.bullets?.join(" ") ?? "";
    expect(traction).not.toContain("$100 million");
    expect(traction).not.toContain("500");
  });

  it("does not treat notes as a product description", () => {
    const judgment = judge({
      track: "startup",
      query: "Mystery Co",
      notes: "They are the leading AI payments network with $40 million ARR.",
      siteQuotes: [],
      headlines: [],
      errors: [],
      sources: [],
    });
    expect(judgment.stance).toBe("Need more information");
  });
});
