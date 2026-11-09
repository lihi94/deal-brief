import { describe, expect, it } from "vitest";
import { unexpectedFigures } from "../lib/figures";
import { maybeRewrite } from "../lib/llm";
import { buildMemo } from "../lib/memo";
import type { PublicContext, StartupContext } from "../lib/types";

const context: PublicContext = {
  track: "public",
  query: "TEST",
  resolved: true,
  companyName: "Test Corp",
  ticker: "TEST",
  businessSummary: "Test Corp sells software.",
  price: 10,
  priceTime: "2026-11-09T14:00:00.000Z",
  marketCap: 5_000_000_000,
  fiscal: {
    revenue: [{ concept: "Revenues", taxonomy: "us-gaap", end: "2025-12-31", filed: "2026-03-01", form: "10-K", value: 1_000_000_000, unit: "USD" }],
    operatingIncome: [{ concept: "OperatingIncomeLoss", taxonomy: "us-gaap", end: "2025-12-31", filed: "2026-03-01", form: "10-K", value: 200_000_000, unit: "USD" }],
    operatingCashFlow: [{ concept: "NetCashProvidedByUsedInOperatingActivities", taxonomy: "us-gaap", end: "2025-12-31", filed: "2026-03-01", form: "10-K", value: 150_000_000, unit: "USD" }],
    equity: [{ concept: "StockholdersEquity", taxonomy: "us-gaap", end: "2025-12-31", filed: "2026-03-01", form: "10-K", value: 300_000_000, unit: "USD" }],
  },
  trailing: {},
  headlines: [],
  errors: [],
  sources: [],
};

describe("figure guard", () => {
  it("flags a dollar figure that is not in the source text", () => {
    const extra = unexpectedFigures("Revenue was $999 billion last year.", "Revenue was $1,000,000,000.");
    expect(extra).toContain(999);
  });

  it("allows figures that already appear in the draft", () => {
    expect(unexpectedFigures("Operating margin was 20.0%.", "Operating margin was 20.0% on $200,000,000.")).toEqual([]);
  });

  it("discards a live draft that invents a figure and keeps the rubric stance", async () => {
    const memo = buildMemo(context, undefined, { now: new Date("2026-11-09T15:00:00.000Z"), mode: "template" });
    const fetchImpl = (async () => new Response(JSON.stringify({
      content: [{
        type: "text",
        text: JSON.stringify({
          rationale: memo.stanceRationale,
          sections: memo.sections.map((section) => ({
            id: section.id,
            paragraphs: section.paragraphs.map((paragraph, index) => index === 0 && section.id === "business"
              ? "The company secretly earned $999 billion and should be rated Attractive."
              : paragraph),
            numbered: section.numbered ?? [],
            bullets: section.bullets ?? [],
            footer: section.footer ?? [],
          })),
        }),
      }],
    }), { status: 200, headers: { "content-type": "application/json" } })) as typeof fetch;

    const result = await maybeRewrite(memo, context, { fetchImpl, env: { key: "test-key", model: "claude-haiku-4-5" } });
    expect(result.generationMode).toBe("template");
    expect(result.generationNote.toLowerCase()).toContain("discarded");
    expect(result.markdown).not.toContain("999");
    expect(result.stance).toBe(memo.stance);
  });

  it("does not call the model when no key is set", async () => {
    const memo = buildMemo(context, undefined, { now: new Date("2026-11-09T15:00:00.000Z") });
    let called = false;
    const fetchImpl = (() => {
      called = true;
      return Promise.resolve(new Response("{}", { status: 200 }));
    }) as typeof fetch;
    const result = await maybeRewrite(memo, context, { fetchImpl, env: { key: "" } });
    expect(called).toBe(false);
    expect(result.generationMode).toBe("template");
  });

  it("rejects a startup rewrite that turns a note into a funding fact", async () => {
    const startup: StartupContext = {
      track: "startup",
      query: "Wiz",
      notes: "Raised $100 million at a $2 billion valuation with 500 people.",
      siteExcerpt: "Wiz connects code, cloud, and runtime into a single security graph for cloud and AI applications across large companies.",
      siteQuotes: ["Trusted by more than 65% of Fortune 100 companies"],
      headlines: [],
      errors: [],
      sources: [{ name: "Company website", url: "https://www.wiz.io/", retrievedAt: "2026-11-09T15:00:00.000Z" }],
    };
    const memo = buildMemo(startup, undefined, { now: new Date("2026-11-09T15:00:00.000Z") });
    const fetchImpl = (async () => new Response(JSON.stringify({
      content: [{
        type: "text",
        text: JSON.stringify({
          rationale: memo.stanceRationale,
          sections: memo.sections.map((section) => ({
            id: section.id,
            paragraphs: section.paragraphs,
            numbered: section.numbered ?? [],
            bullets: section.id === "traction"
              ? [
                  "Traction is the note, not the site.",
                  "Team: 500 employees, taken from the note.",
                  "Funding: $100 million.",
                  "Headcount: 500.",
                  "Valuation: $2 billion.",
                ]
              : (section.bullets ?? []),
            footer: section.footer ?? [],
          })),
        }),
      }],
    }), { status: 200 })) as typeof fetch;
    const result = await maybeRewrite(memo, startup, { fetchImpl, env: { key: "test-key", model: "claude-haiku-4-5" } });
    expect(result.generationMode).toBe("template");
    expect(result.markdown).toContain("Funding: Unknown");
  });
});
