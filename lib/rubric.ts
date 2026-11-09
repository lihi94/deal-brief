import { RUBRIC } from "./constants";
import { formatMultiple, formatPct, formatUsdShort, periodLabel } from "./format";
import type { AnnualFact, Judgment, PublicContext, ResearchContext, StartupContext } from "./types";

export function lastFact(series: AnnualFact[] | undefined): AnnualFact | undefined {
  return series?.length ? series[series.length - 1] : undefined;
}

export function factOn(series: AnnualFact[] | undefined, end: string | undefined): AnnualFact | undefined {
  if (!end) return lastFact(series);
  return series?.find((fact) => fact.end === end) ?? lastFact(series);
}

export function priorFact(series: AnnualFact[] | undefined, end: string | undefined): AnnualFact | undefined {
  if (!series?.length) return undefined;
  const index = end ? series.findIndex((fact) => fact.end === end) : series.length - 1;
  if (index > 0) return series[index - 1];
  return undefined;
}

export function ratio(numerator?: number, denominator?: number): number | undefined {
  if (numerator == null || denominator == null || denominator === 0) return undefined;
  return numerator / denominator;
}

function hasProductDescription(context: StartupContext): boolean {
  return Boolean((context.siteExcerpt && context.siteExcerpt.length >= 80) || context.siteQuotes.length);
}

function siteSaysShutdown(context: StartupContext): boolean {
  const text = `${context.siteExcerpt ?? ""} ${context.siteTitle ?? ""}`;
  return /\b(shut down|ceased operations|out of business|domain (is )?for sale|parked domain)\b/i.test(text);
}

export function judge(context: ResearchContext): Judgment {
  return context.track === "public" ? judgePublic(context) : judgeStartup(context);
}

function judgeStartup(context: StartupContext): Judgment {
  if (siteSaysShutdown(context)) {
    return {
      stance: "Pass",
      conviction: "medium",
      rationale:
        "The fetched site describes a business that has shut down or a domain that is parked. That is a sourced reason to pass rather than to keep a diligence file open. Funding, team, and valuation are not inferred from that page.",
      drivers: ["The company site, not the user notes, is the source for the shutdown or parked-domain reading."],
      blockers: ["No going-concern product description on the fetched site."],
    };
  }

  if (!hasProductDescription(context)) {
    return {
      stance: "Need more information",
      conviction: "low",
      rationale:
        "This pack does not contain a sourced description of what the company sells. User notes, if any, are quoted as unverified and are not evidence. Funding, headcount, and valuation stay Unknown.",
      drivers: ["No usable company-site description, so the stance is Need more information rather than a pass or a diligence memo."],
      blockers: ["Product description is Unknown."],
    };
  }

  return {
    stance: "Diligence further",
    conviction: context.siteQuotes.length || (context.siteExcerpt?.length ?? 0) > 240 ? "medium" : "low",
    rationale:
      "The site is specific enough to say what the company claims to sell, and nothing sourced here shows that the product is gone. That clears the bar for another conversation. It does not clear a venture underwriting: funding, headcount, revenue, and valuation are Unknown unless a source in this pack states them.",
    drivers: ["A public product description was fetched from the company site. Marketing claims stay labeled as claims."],
    blockers: [],
  };
}

function judgePublic(context: PublicContext): Judgment {
  const revenue = lastFact(context.fiscal.revenue);
  const operatingIncome = factOn(context.fiscal.operatingIncome, revenue?.end);
  const equity = factOn(context.fiscal.equity, revenue?.end) ?? lastFact(context.fiscal.equity);
  const cashFlow = factOn(context.fiscal.operatingCashFlow, revenue?.end);
  const margin = ratio(operatingIncome?.value, revenue?.value);
  const multiple = ratio(context.marketCap, revenue?.value);
  const measured: string[] = [];
  const missing: string[] = [];

  if (!revenue) missing.push("Last-fiscal revenue is Unknown, so scale and the revenue multiple cannot be underwritten.");
  if (margin == null) missing.push("Last-fiscal operating margin is Unknown.");
  else if (margin < RUBRIC.minOperatingMargin) {
    measured.push(
      `Operating margin for the year ended ${periodLabel(revenue!.end)} is ${formatPct(margin)}, below the ${formatPct(RUBRIC.minOperatingMargin)} Attractive floor.`,
    );
  }
  if (!equity) missing.push("Book equity is Unknown.");
  else if (equity.value <= 0) measured.push(`Book equity at ${periodLabel(equity.end)} is ${formatUsdShort(equity.value)}.`);
  if (multiple == null) missing.push("Market cap / last-fiscal revenue is Unknown.");
  else if (multiple > RUBRIC.maxRevenueMultiple) {
    measured.push(
      `Market cap / last-fiscal revenue is ${formatMultiple(multiple)}, above the ${RUBRIC.maxRevenueMultiple}× Attractive ceiling.`,
    );
  }
  if (cashFlow && cashFlow.value < 0) measured.push(`Operating cash flow for the year ended ${periodLabel(cashFlow.end)} is negative.`);
  else if (!cashFlow) missing.push("Last-fiscal operating cash flow is Unknown.");

  const businessVisible = Boolean(revenue || context.businessSummary || context.price);
  if (!context.resolved || (!context.price && !revenue && !context.businessSummary)) {
    return {
      stance: "Pass",
      conviction: "low",
      rationale: `Could not build a source pack for “${context.query}”. With no quote, no filing facts, and no business description, there is nothing to underwrite.`,
      drivers: ["Issuer data did not resolve."],
      blockers: ["Identity and financials are Unknown."],
    };
  }

  const distressed = margin != null && margin < RUBRIC.distressOperatingMargin && !!equity && equity.value < 0 && !!cashFlow && cashFlow.value < 0;
  if (distressed) {
    return {
      stance: "Pass",
      conviction: "high",
      rationale:
        "The last fiscal year shows an operating margin below -15%, negative book equity, and negative operating cash flow. That is the rubric’s distress test. Gross margin alone would not offset all three.",
      drivers: measured,
      blockers: measured,
    };
  }

  const blockers = [...measured, ...missing];
  if (!businessVisible) {
    return {
      stance: "Pass",
      conviction: "low",
      rationale: "The name did not resolve to a described business or a revenue figure.",
      drivers: ["No business description and no revenue."],
      blockers,
    };
  }

  if (blockers.length) {
    const high = measured.length > 0 && Boolean(revenue && context.price && equity);
    return {
      stance: "Watch",
      conviction: high ? "high" : missing.length > measured.length ? "low" : "medium",
      rationale: watchRationale(measured, missing),
      drivers: blockers,
      blockers,
    };
  }

  return {
    stance: "Attractive",
    conviction: "high",
    rationale: `Every Attractive gate in the rubric clears on sourced figures: last-fiscal operating margin is at least ${formatPct(RUBRIC.minOperatingMargin)}, book equity is positive, operating cash flow is not negative, and market cap is at or below ${RUBRIC.maxRevenueMultiple}× last-fiscal revenue (${formatMultiple(multiple!)}). This is a screen, not a price target.`,
    drivers: [
      `Operating margin ${formatPct(margin!)} clears ${formatPct(RUBRIC.minOperatingMargin)}.`,
      `Book equity is positive (${formatUsdShort(equity!.value)}).`,
      `Market cap / last-fiscal revenue is ${formatMultiple(multiple!)}, within the ${RUBRIC.maxRevenueMultiple}× ceiling.`,
    ],
    blockers: [],
  };
}

function watchRationale(measured: string[], missing: string[]): string {
  if (measured.length && !missing.length) {
    return `The business is identifiable and the blocking facts are measured, so this is Watch rather than a data gap. Attractive is refused because: ${measured.join(" ")} One failed gate is enough. The rubric does not average a strong gross margin or a low multiple back into Attractive.`;
  }
  if (measured.length) {
    return `Watch. Some Attractive gates fail on measured figures (${measured.join(" ")}). Other inputs are still Unknown (${missing.join(" ")}). Unknown is not treated as a pass, and it is not filled in.`;
  }
  return `Watch, at low conviction. A listed business is visible, but the pack is missing gates the rubric requires before Attractive: ${missing.join(" ")}`;
}
