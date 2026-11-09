import { randomUUID } from "node:crypto";
import { DISCLAIMER, RUBRIC, SAMPLE_NOTE, TEMPLATE_NOTE } from "./constants";
import { filingIndexUrl } from "./sources/edgar";
import {
  formatGeneratedDate,
  formatMultiple,
  formatPct,
  formatShares,
  formatTimestamp,
  formatUsd,
  formatUsdExact,
  formatUsdShort,
  periodLabel,
  slugify,
  firstSentence,
} from "./format";
import { renderMarkdown } from "./markdown";
import { factOn, judge, lastFact, priorFact, ratio } from "./rubric";
import type {
  AnnualFact,
  GenerationMode,
  Headline,
  Judgment,
  Memo,
  MemoSection,
  PublicContext,
  ResearchContext,
  StartupContext,
} from "./types";

export type MemoOptions = {
  mode?: GenerationMode;
  now?: Date;
  id?: string;
  note?: string;
  model?: string;
};

export function buildMemo(context: ResearchContext, judgment: Judgment = judge(context), options: MemoOptions = {}): Memo {
  const generatedAt = (options.now ?? new Date()).toISOString();
  const mode = options.mode ?? "template";
  const memoWithoutMarkdown = context.track === "public"
    ? publicMemo(context, judgment, generatedAt, mode, options)
    : startupMemo(context, judgment, generatedAt, mode, options);
  return { ...memoWithoutMarkdown, markdown: renderMarkdown(memoWithoutMarkdown) };
}

function generationNote(mode: GenerationMode, override?: string): string {
  if (override) return override;
  if (mode === "sample") return SAMPLE_NOTE;
  if (mode === "live-ai") return "Prose was rewritten by the configured model after a figure check against the source pack. The stance was not taken from the model.";
  return TEMPLATE_NOTE;
}

function publicMemo(
  context: PublicContext,
  judgment: Judgment,
  generatedAt: string,
  mode: GenerationMode,
  options: MemoOptions,
): Omit<Memo, "markdown"> {
  const subject = context.companyName ?? context.query;
  const revenue = lastFact(context.fiscal.revenue);
  const revenueEnd = revenue?.end;
  const operatingIncome = factOn(context.fiscal.operatingIncome, revenueEnd);
  const grossProfit = factOn(context.fiscal.grossProfit, revenueEnd);
  const netIncome = factOn(context.fiscal.netIncome, revenueEnd);
  const cashFlow = factOn(context.fiscal.operatingCashFlow, revenueEnd);
  const equity = factOn(context.fiscal.equity, revenueEnd) ?? lastFact(context.fiscal.equity);
  const margin = ratio(operatingIncome?.value, revenue?.value);
  const grossMargin = ratio(grossProfit?.value, revenue?.value);
  const multiple = ratio(context.marketCap, revenue?.value);
  const priorRevenue = priorFact(context.fiscal.revenue, revenueEnd);
  const priorOperating = priorRevenue ? factOn(context.fiscal.operatingIncome, priorRevenue.end) : undefined;
  const priorMargin = ratio(priorOperating?.value, priorRevenue?.value);
  const filingUrl = revenue && context.cik ? filingIndexUrl(context.cik, revenue.accn) : undefined;

  const sections: MemoSection[] = [
    snapshotSection(context, revenue),
    businessSection(context),
    {
      id: "thesis",
      heading: "Investment thesis",
      paragraphs: [
        "These points use only figures and descriptions in the source pack, plus the written rubric. They are not a forecast.",
      ],
      numbered: thesisPoints(context, {
        revenue,
        operatingIncome,
        grossProfit,
        cashFlow,
        equity,
        margin,
        grossMargin,
        priorMargin,
        priorRevenue,
        multiple,
      }),
    },
    changeMindSection(judgment, multiple, margin, equity?.value),
    financialSection(context, filingUrl),
    valuationSection(context, revenue, multiple, equity?.value),
    risksSection(context, judgment, margin, priorMargin),
    {
      id: "bottom-line",
      heading: "Bottom line",
      paragraphs: [bottomLine(judgment, context, margin, multiple, grossMargin, cashFlow?.value, equity?.value)],
    },
  ];

  return {
    id: options.id ?? `${slugify(context.ticker ?? subject)}-${generatedAt.slice(0, 10)}-${randomUUID().slice(0, 8)}`,
    track: "public",
    subject,
    ticker: context.ticker,
    generatedAt,
    stance: judgment.stance,
    conviction: judgment.conviction,
    stanceRationale: judgment.rationale,
    drivers: judgment.drivers,
    sections,
    sources: withFilingSource(context, filingUrl, generatedAt),
    generationMode: mode,
    generationNote: generationNote(mode, options.note),
    model: options.model,
    disclaimer: DISCLAIMER,
  };
}

function snapshotSection(context: PublicContext, revenue: AnnualFact | undefined): MemoSection {
  const priceDate = context.priceTime ? formatTimestamp(context.priceTime) : "Unknown";
  const rows: string[][] = [
    ["Company", context.companyName ?? "Unknown", context.companyName ? "Yahoo Finance or SEC submissions" : "—"],
    ["Ticker", context.ticker ?? "Unknown", context.ticker ? "Query / SEC company tickers" : "—"],
    ["Exchange", context.exchange ?? "Unknown", context.exchange ? "Yahoo Finance or SEC submissions" : "—"],
    ["Sector", context.sector ?? "Unknown", context.sector ? "Yahoo Finance profile" : "—"],
    ["Industry", context.industry ?? "Unknown", context.industry ? "Yahoo Finance profile" : "—"],
    ["SIC", context.sic ?? "Unknown", context.sic ? "SEC submissions" : "—"],
    ["Last price", context.price != null ? `${formatUsdShort(context.price)} ${context.currency ?? ""}`.trim() : "Unknown", context.price != null ? "Yahoo Finance" : "—"],
    ["Date of price", context.price != null ? priceDate : "Unknown", context.priceTime ? "Yahoo Finance regularMarketTime" : "—"],
    ["Market cap", context.marketCap != null ? formatUsd(context.marketCap) : "Unknown", context.marketCap != null ? "Yahoo Finance quoteSummary" : "—"],
    ["Employees", context.employees != null ? context.employees.toLocaleString("en-US") : "Unknown", context.employees != null ? "Yahoo Finance profile, not a headcount we counted" : "—"],
    ["Latest fiscal year used", revenue ? `Year ended ${periodLabel(revenue.end)}` : "Unknown", revenue ? `${revenue.form}, filed ${periodLabel(revenue.filed)}` : "—"],
  ];
  return {
    id: "snapshot",
    heading: "Snapshot",
    paragraphs: [
      "Every populated cell below is copied from a fetched source. Anything the source pack does not contain is Unknown. Sell-side targets and recommendation strings are ignored.",
      context.errors.length ? `Fetch gaps: ${context.errors.join(" ")}` : "The quote and filing requests that this memo relies on returned data.",
    ],
    table: { caption: "Snapshot. Empty means Unknown, not zero.", columns: ["Field", "Value", "Source"], rows },
  };
}

function businessSection(context: PublicContext): MemoSection {
  if (!context.businessSummary) {
    return {
      id: "business",
      heading: "Business",
      paragraphs: [
        context.sic
          ? `A business description was not in the Yahoo profile. The SEC SIC classification on file is ${context.sic}. That is a classification, not a description of the product.`
          : "Business description: Unknown. The source pack has no company profile text and no SIC description.",
      ],
    };
  }
  return {
    id: "business",
    heading: "Business",
    paragraphs: [
      `${firstSentence(context.businessSummary)} (Yahoo Finance company profile.)`,
      "That paragraph is a profile, not diligence. It tells me the reported line of business. It does not tell me whether the economics clear the rubric.",
    ],
  };
}

type ThesisInputs = {
  revenue?: AnnualFact;
  operatingIncome?: AnnualFact;
  grossProfit?: AnnualFact;
  cashFlow?: AnnualFact;
  equity?: AnnualFact;
  margin?: number;
  grossMargin?: number;
  priorMargin?: number;
  priorRevenue?: AnnualFact;
  multiple?: number;
};

function thesisPoints(context: PublicContext, facts: ThesisInputs): string[] {
  const points: string[] = [];
  if (facts.revenue && facts.margin != null) {
    const prior =
      facts.priorMargin != null && facts.priorRevenue
        ? ` A year earlier, the year ended ${periodLabel(facts.priorRevenue.end)}, operating margin was ${formatPct(facts.priorMargin)}.`
        : "";
    const gross = facts.grossMargin != null ? ` Gross margin was ${formatPct(facts.grossMargin)}.` : "";
    points.push(
      `For the year ended ${periodLabel(facts.revenue.end)}, revenue was ${formatUsd(facts.revenue.value)} and operating margin was ${formatPct(facts.margin)}.${gross}${prior} Source: SEC ${facts.revenue.form}, concept ${facts.revenue.concept}, filed ${periodLabel(facts.revenue.filed)}.`,
    );
  } else if (context.businessSummary) {
    points.push(`The sourced profile places this in ${context.industry ?? context.sector ?? "an industry the profile names"}. ${firstSentence(context.businessSummary)}`);
  }

  if (facts.cashFlow && facts.revenue) {
    const cashIsReal = facts.cashFlow.value > 0;
    points.push(
      `Operating cash flow for the year ended ${periodLabel(facts.cashFlow.end)} was ${formatUsd(facts.cashFlow.value)}. ${
        cashIsReal
          ? "Cash generation shows up on the cash flow statement, which is a separate fact from operating margin."
          : "The cash flow statement does not show positive operating cash flow for that year."
      }`,
    );
  }

  if (facts.multiple != null && context.marketCap != null && facts.revenue) {
    points.push(
      `Market cap of ${formatUsd(context.marketCap)} (${context.priceTime ? formatTimestamp(context.priceTime) : "quote time Unknown"}) divided by revenue for the year ended ${periodLabel(facts.revenue.end)} is ${formatMultiple(facts.multiple)}. The Attractive ceiling in the rubric is ${RUBRIC.maxRevenueMultiple}× last-fiscal revenue. This is not a DCF.`,
    );
  }

  if (facts.equity) {
    points.push(
      `Book equity at ${periodLabel(facts.equity.end)} was ${formatUsd(facts.equity.value)} on Form ${facts.equity.form}. ${
        facts.equity.value <= 0
          ? "Negative book equity blocks Attractive on its own. I am not guessing why the equity account is negative."
          : "Positive book equity clears that particular gate. It does not, by itself, make the stock Attractive."
      }`,
    );
  }

  if (points.length < 2) {
    points.push("The source pack is too thin for a longer thesis. I would rather leave the missing lines Unknown than invent a story around the ticker.");
  }
  return points.slice(0, 4);
}

function changeMindSection(judgment: Judgment, multiple?: number, margin?: number, equity?: number): MemoSection {
  const floor = formatPct(RUBRIC.minOperatingMargin);
  const cap = `${RUBRIC.maxRevenueMultiple}×`;
  let lead: string;
  const numbered: string[] = [];
  if (judgment.stance === "Attractive") {
    lead = "Attractive here means every written gate cleared on the latest sourced fiscal year and the current market cap. I would leave Attractive if a later filing or quote broke any gate.";
    numbered.push(
      `Operating margin on the next annual report prints below ${floor}.`,
      "Book equity is zero or negative, or operating cash flow for the year is negative.",
      `Market cap moves above ${cap} last-fiscal revenue. The multiple on this pack is ${multiple != null ? formatMultiple(multiple) : "Unknown"}.`,
    );
  } else if (judgment.stance === "Pass" && judgment.conviction === "low") {
    lead = "This is a Pass because the file is empty, not because I measured a broken business. I would reopen it as Watch once a quote or a filing actually arrives.";
    numbered.push("A market quote resolves the issuer, the price, and the date of that price.", "SEC company facts include a last-fiscal revenue figure and an operating-income figure for the same period.", "A business description shows up in the profile or the filing, so the memo is no longer a ticker with no company behind it.");
  } else if (judgment.stance === "Pass") {
    lead = "The distress test fired: deep operating loss, negative book equity, and negative operating cash flow were all present. I would move this back to Watch only if that trio is no longer all true.";
    numbered.push(`Operating margin is no longer below ${formatPct(RUBRIC.distressOperatingMargin)}, or book equity turns positive, or operating cash flow turns non-negative.`, "A single improvement is enough to leave Pass. It is not enough for Attractive.", `Attractive still needs margin of at least ${floor}, positive equity, non-negative operating cash flow, and a multiple at or below ${cap}.`);
  } else {
    lead = `I would call this Attractive only when every gate is true at the same time: operating margin at least ${floor}, positive book equity, operating cash flow that is not negative when the filing reports it, and market cap at or below ${cap} last-fiscal revenue. Clearing one gate does not offset a failed one.`;
    if (margin != null && margin < RUBRIC.minOperatingMargin) {
      numbered.push(`The latest fiscal operating margin is ${formatPct(margin)}. It has to print at or above ${floor} before this gate opens.`);
    }
    if (equity != null && equity <= 0) numbered.push(`Book equity is ${formatUsdShort(equity)}. Attractive requires a positive equity account.`);
    if (multiple != null && multiple > RUBRIC.maxRevenueMultiple) {
      numbered.push(`The revenue multiple is ${formatMultiple(multiple)}. It has to be ${cap} or below. I will not invent a DCF to talk past that ceiling.`);
    }
    if (!numbered.length) numbered.push("The open items are the Unknown lines in the snapshot. They have to be filled from a source, not from a guess.");
    numbered.push("User commentary and sell-side targets would not change this. They are not in the source pack.");
  }
  return { id: "change-mind", heading: "What would change my mind", paragraphs: [lead], numbered };
}

function financialSection(context: PublicContext, filingUrl?: string): MemoSection {
  const ends = fiscalColumns(context);
  if (!ends.length) {
    return {
      id: "financials",
      heading: "Financial highlights",
      paragraphs: ["Fiscal figures: Unknown. SEC company facts did not yield an annual revenue, profit, cash flow, or equity series for this issuer."],
    };
  }
  const lines: { label: string; series: AnnualFact[] | undefined; kind: "money" | "margin" }[] = [
    { label: "Revenue", series: context.fiscal.revenue, kind: "money" },
    { label: "Gross profit", series: context.fiscal.grossProfit, kind: "money" },
    { label: "Operating income", series: context.fiscal.operatingIncome, kind: "money" },
    { label: "Net income", series: context.fiscal.netIncome, kind: "money" },
    { label: "Operating cash flow", series: context.fiscal.operatingCashFlow, kind: "money" },
    { label: "Stockholders' equity", series: context.fiscal.equity, kind: "money" },
  ];
  const columns = ["Line", ...ends.map((end) => `Year ended ${periodLabel(end)}`)];
  const rows = lines.map((line) => [
    line.label,
    ...ends.map((end) => {
      const fact = line.series?.find((item) => item.end === end);
      return fact ? formatUsdExact(fact.value) : "Unknown";
    }),
  ]);
  rows.push([
    "Operating margin (calculated)",
    ...ends.map((end) => {
      const income = context.fiscal.operatingIncome?.find((item) => item.end === end);
      const revenue = context.fiscal.revenue?.find((item) => item.end === end);
      const margin = ratio(income?.value, revenue?.value);
      return margin == null ? "Unknown" : formatPct(margin);
    }),
  ]);
  rows.push([
    "Gross margin (calculated)",
    ...ends.map((end) => {
      const gross = context.fiscal.grossProfit?.find((item) => item.end === end);
      const revenue = context.fiscal.revenue?.find((item) => item.end === end);
      const margin = ratio(gross?.value, revenue?.value);
      return margin == null ? "Unknown" : formatPct(margin);
    }),
  ]);

  const paragraphs = [
    "Annual figures are from SEC company facts, limited to full-year 10-K, 20-F, or 40-F facts. Margins are calculated from those rows and labeled as calculated. A cell is Unknown when that concept was not in the filing facts for that year.",
    filingUrl ? `Filing index for the latest revenue fact: ${filingUrl}.` : "No accession number was attached to the latest revenue fact.",
  ];
  const trailing = trailingRowsFor(context);
  return {
    id: "financials",
    heading: "Financial highlights",
    paragraphs,
    table: { caption: "Fiscal year facts from SEC company facts. Not a forecast.", columns, rows },
    footer: trailing ? [trailing] : undefined,
  };
}

function trailingRowsFor(context: PublicContext): string | undefined {
  const trailing = context.trailing;
  const bits: string[] = [];
  if (trailing.revenue != null) bits.push(`trailing revenue ${formatUsd(trailing.revenue)}`);
  if (trailing.grossMargin != null) bits.push(`trailing gross margin ${formatPct(trailing.grossMargin)}`);
  if (trailing.operatingMargin != null) bits.push(`trailing operating margin ${formatPct(trailing.operatingMargin)}`);
  if (trailing.profitMargin != null) bits.push(`trailing profit margin ${formatPct(trailing.profitMargin)}`);
  if (trailing.operatingCashFlow != null) bits.push(`trailing operating cash flow ${formatUsd(trailing.operatingCashFlow)}`);
  if (trailing.freeCashFlow != null) bits.push(`trailing free cash flow ${formatUsd(trailing.freeCashFlow)}`);
  if (trailing.totalCash != null) bits.push(`cash ${formatUsd(trailing.totalCash)}`);
  if (trailing.totalDebt != null) bits.push(`total debt ${formatUsd(trailing.totalDebt)}`);
  if (trailing.trailingEps != null) bits.push(`trailing EPS ${trailing.trailingEps.toFixed(2)} ${context.currency ?? ""}`.trim());
  if (!bits.length) return undefined;
  const asOf = trailing.mostRecentQuarter ? ` Yahoo’s most recent quarter date on the statistic is ${periodLabel(trailing.mostRecentQuarter)}.` : "";
  return `Trailing quote statistics from Yahoo Finance, which are not the fiscal-year rows above and are not a forecast: ${bits.join("; ")}.${asOf}`;
}

function valuationSection(context: PublicContext, revenue: AnnualFact | undefined, multiple?: number, equity?: number): MemoSection {
  if (context.marketCap == null || !revenue || multiple == null) {
    return {
      id: "valuation",
      heading: "Valuation context",
      paragraphs: [
        "Valuation context: Unknown. I need both a market cap and a last-fiscal revenue figure before I will state a multiple. This memo does not invent a DCF, a terminal growth rate, or a price target.",
      ],
    };
  }
  const paragraphs = [
    `Market cap ${formatUsd(context.marketCap)} divided by revenue of ${formatUsd(revenue.value)} for the year ended ${periodLabel(revenue.end)} is ${formatMultiple(multiple)}. The rubric’s Attractive ceiling is ${RUBRIC.maxRevenueMultiple}×. ${
      multiple > RUBRIC.maxRevenueMultiple ? "This print is above that ceiling, so valuation alone refuses Attractive." : "This print is within that ceiling. The other gates still have to clear."
    }`,
  ];
  if (context.enterpriseValue != null) {
    const evMultiple = ratio(context.enterpriseValue, revenue.value);
    paragraphs.push(
      `Yahoo Finance also reports enterprise value of ${formatUsd(context.enterpriseValue)}. Divided by the same fiscal revenue, that is ${evMultiple != null ? formatMultiple(evMultiple) : "Unknown"}. Enterprise value is a quote statistic, not a cash-flow model.`,
    );
  }
  if (equity != null && equity <= 0) {
    paragraphs.push("Price to book is not used. Book equity is negative, so a book multiple would not mean what it means for a company with positive equity.");
  } else if (context.bookValuePerShare != null && context.bookValuePerShare > 0 && context.price != null) {
    paragraphs.push(
      `Yahoo Finance reports book value of ${context.bookValuePerShare.toFixed(2)} per share. The last price is ${formatUsdShort(context.price)}, which is ${(context.price / context.bookValuePerShare).toFixed(2)}× that book value. Both inputs are quote statistics.`,
    );
  }
  paragraphs.push("No discounted-cash-flow value is computed. A missing forecast stays missing.");
  return { id: "valuation", heading: "Valuation context", paragraphs };
}

function risksSection(context: PublicContext, judgment: Judgment, margin?: number, priorMargin?: number): MemoSection {
  const bullets = [...judgment.blockers];
  if (margin != null && priorMargin != null && priorMargin - margin >= 0.03) {
    bullets.push(
      `Operating margin moved from ${formatPct(priorMargin)} to ${formatPct(margin)} over the two latest fiscal years in the source pack. The rubric uses the latest year.`,
    );
  }
  const trailingMargin = context.trailing.operatingMargin;
  if (margin != null && trailingMargin != null && Math.sign(margin) !== Math.sign(trailingMargin) && trailingMargin !== 0 && margin !== 0) {
    bullets.push(
      `The fiscal operating margin (${formatPct(margin)}) and Yahoo’s trailing operating margin (${formatPct(trailingMargin)}) do not have the same sign. The rubric uses the fiscal year. The trailing figure is still part of the risk, because the year in progress may not look like the last annual report.`,
    );
  } else if (margin != null && trailingMargin != null && margin < RUBRIC.minOperatingMargin && trailingMargin < RUBRIC.minOperatingMargin) {
    bullets.push(`Yahoo’s trailing operating margin is ${formatPct(trailingMargin)}, also below the ${formatPct(RUBRIC.minOperatingMargin)} floor. That is a quote statistic, reported beside the fiscal figure rather than mixed into it.`);
  }
  const form = lastFact(context.fiscal.revenue)?.form;
  if (form?.startsWith("20-F") || form?.startsWith("40-F")) {
    bullets.push(`The annual report is a ${form}, so this issuer files as a foreign private issuer. The numbers are only as current as that form.`);
  }
  if (context.headlines.length) {
    bullets.push("Headlines below are titles only. Article bodies were not fetched, and a headline is not a finding.");
  } else {
    bullets.push("No public headlines came back with this pull. Absence of headlines is not the same thing as absence of news.");
  }
  bullets.push("This is a screen of reported figures. It is not a view on management, competitive position, or the next quarter.");
  const section: MemoSection = { id: "risks", heading: "Key risks", paragraphs: [], bullets };
  if (context.headlines.length) {
    section.paragraphs.push("Recent headlines:");
    section.bullets = [...(section.bullets ?? []), ...context.headlines.map(formatHeadline)];
  }
  return section;
}

function bottomLine(
  judgment: Judgment,
  context: PublicContext,
  margin?: number,
  multiple?: number,
  grossMargin?: number,
  cashFlow?: number,
  equity?: number,
): string {
  const name = context.companyName ?? context.ticker ?? context.query;
  const conviction = `${judgment.conviction} conviction`;
  if (judgment.stance === "Watch" && margin != null && margin < RUBRIC.minOperatingMargin && equity != null && equity <= 0 && (grossMargin ?? 0) >= 0.5 && (cashFlow ?? 0) > 0) {
    return `${judgment.stance}, ${conviction}. ${name} has a real gross margin (${formatPct(grossMargin!)}) and positive operating cash flow (${formatUsd(cashFlow!)}). I still refuse Attractive. The latest fiscal operating margin is ${formatPct(margin)}, and book equity is ${formatUsd(equity)}. Either fact is enough under the rubric.`;
  }
  if (judgment.stance === "Watch" && multiple != null && multiple > RUBRIC.maxRevenueMultiple && (margin ?? 0) >= RUBRIC.minOperatingMargin && (equity ?? 0) > 0) {
    return `${judgment.stance}, ${conviction}. The filing is strong on the reported operating margin${margin != null ? ` (${formatPct(margin)})` : ""} and book equity is positive. Market cap / last-fiscal revenue is ${formatMultiple(multiple)}, above the ${RUBRIC.maxRevenueMultiple}× ceiling, so this is not Attractive. No DCF is being used to bridge that gap.`;
  }
  return `${judgment.stance}, ${conviction}. ${judgment.rationale}`;
}

function startupMemo(
  context: StartupContext,
  judgment: Judgment,
  generatedAt: string,
  mode: GenerationMode,
  options: MemoOptions,
): Omit<Memo, "markdown"> {
  const subject = context.query;
  const sections: MemoSection[] = [
    whatTheyDo(context),
    marketSection(context),
    tractionSection(context),
    underwriteSection(),
    diligenceSection(context),
    unknownsSection(context),
    {
      id: "bottom-line",
      heading: "Bottom line",
      paragraphs: [
        `${judgment.stance}, ${judgment.conviction} conviction. ${judgment.rationale}`,
      ],
    },
  ];
  if (context.notes) {
    sections.splice(6, 0, {
      id: "notes",
      heading: "Analyst notes (unverified)",
      paragraphs: ["The following text was typed into the form. It is not a source. It was not used to choose the stance, and it is not converted into a fact anywhere else in this memo."],
      quotes: [{ text: context.notes, note: "Unverified user note." }],
    });
  }
  return {
    id: options.id ?? `${slugify(context.query)}-${generatedAt.slice(0, 10)}-${randomUUID().slice(0, 8)}`,
    track: "startup",
    subject,
    generatedAt,
    stance: judgment.stance,
    conviction: judgment.conviction,
    stanceRationale: judgment.rationale,
    drivers: judgment.drivers,
    sections,
    sources: context.sources,
    generationMode: mode,
    generationNote: generationNote(mode, options.note),
    model: options.model,
    disclaimer: DISCLAIMER,
  };
}

function whatTheyDo(context: StartupContext): MemoSection {
  if (!context.siteExcerpt && !context.siteQuotes.length) {
    return {
      id: "what",
      heading: "What they do and why it might matter now",
      paragraphs: [
        "Unknown. No company website text was available, so this memo will not describe the product from the name alone or from the notes.",
      ],
    };
  }
  const paragraphs = [
    context.siteExcerpt
      ? `From the fetched site: ${context.siteExcerpt}`
      : "The fetch produced a short claim rather than a full description.",
    "Why it might matter is only as strong as that description. Independent evidence that the problem is urgent, or that buyers are switching, is not in this pack.",
  ];
  const quotes = context.siteQuotes.map((text) => ({
    text,
    note: "Company claim, quoted from the site. Not independently verified.",
  }));
  return { id: "what", heading: "What they do and why it might matter now", paragraphs, quotes };
}

function marketSection(context: StartupContext): MemoSection {
  const bullets = context.headlines.map(formatHeadline);
  return {
    id: "market",
    heading: "Market / why now",
    paragraphs: [
      "Market size, growth, and share are Unknown. This pack has no third-party market study, and the company site is not treated as one.",
      context.coverageNote ?? "A few public headlines were retrieved. They are coverage, not a market model.",
      context.headlines.length ? "Recent headlines:" : "No headlines were retrieved.",
    ],
    bullets: bullets.length ? bullets : undefined,
  };
}

function tractionSection(context: StartupContext): MemoSection {
  const bullets = [
    context.siteQuotes.length
      ? "Traction that the site itself claims is quoted in the first section and labeled as a company claim. It is not booked here as revenue, logos verified by us, or retention."
      : "Traction: Unknown. The site extract did not include a customer, usage, or revenue claim that this memo is willing to quote.",
    "Team: Unknown.",
    "Funding: Unknown. Headline dollar figures, if any appear below, are not recorded as a round.",
    "Headcount: Unknown.",
    "Valuation: Unknown.",
  ];
  return {
    id: "traction",
    heading: "Traction, team, funding",
    paragraphs: ["Only sourced items would be filled in. Nothing below is inferred from the company name or from user notes."],
    bullets,
  };
}

function underwriteSection(): MemoSection {
  return {
    id: "underwrite",
    heading: "How we'd underwrite",
    paragraphs: [
      "Diligence further means the product description is specific enough to keep reading. It does not mean the investment works. These are the statements that would have to be true, and none of them is established by this pack:",
    ],
    numbered: [
      "A buyer pays for the product as a system they keep, not as a pilot that expires. Retention and expansion are Unknown here.",
      "The company’s books, which we do not have, show a gross margin and a cash pattern that can support the story the site tells.",
      "The competitive alternative is something a customer would actually replace. The site’s comparison, if it makes one, is a claim.",
      "Any price for the round is on a document we have not seen. Until then the price is Unknown, and Unknown is not a bargain.",
    ],
  };
}

function diligenceSection(context: StartupContext): MemoSection {
  return {
    id: "diligence",
    heading: "Diligence questions / key risks",
    paragraphs: ["Questions, not findings. Where the pack is silent, the answer is Unknown."],
    bullets: [
      "What is revenue, growth, and the definition of that revenue, from the company’s own books?",
      "Which of the site’s customer claims are dollars, and which are logos or marketing copy?",
      "Who are the founders and the operating owners? Team is Unknown in this pack.",
      "What were the last round’s amount, date, and price? Funding and valuation are Unknown unless a primary source states them.",
      "What would make the product unnecessary if a platform vendor bundled the same control?",
      context.coverageNote ?? "Headline coverage may be thin. Thin coverage is a diligence limit, not a negative finding.",
      "User notes are not answers to these questions.",
    ],
  };
}

function unknownsSection(context: StartupContext): MemoSection {
  const bullets = [
    "Revenue, growth rate, and retention: Unknown.",
    "Funding rounds, investors, and amounts: Unknown.",
    "Valuation: Unknown.",
    "Headcount: Unknown.",
    "Ownership and cap table: Unknown.",
    "Gross margin, burn, and runway: Unknown.",
  ];
  if (!context.websiteUrl) bullets.push("Company website: not supplied, so product text is Unknown unless a headline described it (headlines were not treated as a product source).");
  if (context.errors.length) bullets.push(`Fetch notes: ${context.errors.join(" ")}`);
  return {
    id: "unknowns",
    heading: "Unknowns",
    paragraphs: [
      "These items stay Unknown on purpose. A headline that mentions a price or a round is not promoted into this list. User notes are not promoted into this list.",
    ],
    bullets,
  };
}

function fiscalColumns(context: PublicContext): string[] {
  const ends = new Set<string>();
  for (const series of Object.values(context.fiscal)) {
    for (const fact of series ?? []) ends.add(fact.end);
  }
  return [...ends].sort().slice(-3);
}

function formatHeadline(headline: Headline): string {
  const source = headline.source ? `${headline.source} — ` : "";
  const when = headline.published ? ` (${headline.published})` : "";
  const link = headline.url ? ` ${headline.url}` : "";
  return `${source}${headline.title}${when}.${link}`.trim();
}

function withFilingSource(context: PublicContext, filingUrl: string | undefined, retrievedAt: string) {
  if (!filingUrl) return context.sources;
  if (context.sources.some((source) => source.url === filingUrl)) return context.sources;
  return [...context.sources, { name: "SEC filing index", url: filingUrl, retrievedAt }];
}

