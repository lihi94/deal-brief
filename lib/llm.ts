import { RUBRIC } from "./constants";
import { collectNumbers, unexpectedFigures } from "./figures";
import { renderMarkdown } from "./markdown";
import type { Memo, MemoSection, ResearchContext } from "./types";

const REJECTED_NOTE =
  "A live model draft was discarded because it introduced a figure that is not in the source pack. The text below is the structured template. The stance comes from the written rubric, not from the model.";

const PINNED_PHRASES = [
  "Funding: Unknown",
  "Headcount: Unknown",
  "Valuation: Unknown",
  "Team: Unknown",
  "It is not a source.",
];

function proseWithoutNotes(memo: Memo): string {
  return memo.sections
    .filter((section) => section.id !== "notes")
    .map((section) => JSON.stringify({
      paragraphs: section.paragraphs,
      numbered: section.numbered,
      bullets: section.bullets,
      footer: section.footer,
      table: section.table,
    }))
    .join("\n");
}

const FAILED_NOTE =
  "Live rewrite was not used because the model request failed. The text below is the structured template. The stance comes from the written rubric, not from the model.";

type RewritePayload = {
  sections?: {
    id?: string;
    paragraphs?: string[];
    numbered?: string[];
    bullets?: string[];
    footer?: string[];
  }[];
  rationale?: string;
};

export type RewriteDeps = {
  fetchImpl?: typeof fetch;
  env?: { key?: string; model?: string };
};

export async function maybeRewrite(memo: Memo, context: ResearchContext, deps: RewriteDeps = {}): Promise<Memo> {
  if (memo.generationMode === "sample") return memo;
  const env = deps.env ?? { key: process.env.ANTHROPIC_API_KEY, model: process.env.ANTHROPIC_MODEL };
  const key = env.key?.trim();
  if (!key) return memo;

  const model = env.model?.trim() || "claude-haiku-4-5";
  const fetchImpl = deps.fetchImpl ?? fetch;
  try {
    const response = await fetchImpl("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 4000,
        temperature: 0,
        messages: [{ role: "user", content: prompt(memo) }],
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) return { ...finish(memo, "template", FAILED_NOTE) };
    const body = (await response.json()) as { content?: { type?: string; text?: string }[] };
    const text = body.content?.find((block) => block.type === "text")?.text ?? "";
    const parsed = parsePayload(text);
    if (!parsed) return { ...finish(memo, "template", FAILED_NOTE) };
    const rewritten = applyRewrite(memo, parsed, model);
    const allowText = `${proseWithoutNotes(memo)}\n${RUBRIC.minOperatingMargin} ${RUBRIC.maxRevenueMultiple} ${RUBRIC.distressOperatingMargin} 8% 15× -15%`;
    const unexpected = unexpectedFigures(proseWithoutNotes(rewritten), allowText, collectNumbers(context));
    const droppedPin = PINNED_PHRASES.some((phrase) => memo.markdown.includes(phrase) && !rewritten.markdown.includes(phrase));
    if (unexpected.length || droppedPin || !rewritten.markdown.includes(memo.stance)) {
      return { ...finish(memo, "template", REJECTED_NOTE) };
    }
    return rewritten;
  } catch {
    return { ...finish(memo, "template", FAILED_NOTE) };
  }
}

function prompt(memo: Memo): string {
  const slim = memo.sections.map((section) => ({
    id: section.id,
    heading: section.heading,
    paragraphs: section.paragraphs,
    numbered: section.numbered ?? [],
    bullets: section.bullets ?? [],
    footer: section.footer ?? [],
  }));
  return [
    "You rewrite sentences in a screening memo. You do not add facts.",
    `The stance is already decided and must stay exactly: ${memo.stance}.`,
    "Do not introduce any number, percent, multiple, date, or dollar figure that is not already in the draft.",
    "Do not promote user notes into facts. Do not invent funding, valuation, headcount, or a DCF.",
    "Return JSON only, with the same section ids and the same count of paragraphs, numbered items, bullets, and footer lines.",
    JSON.stringify({ rationale: memo.stanceRationale, sections: slim }),
  ].join("\n");
}

function parsePayload(text: string): RewritePayload | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as RewritePayload;
  } catch {
    return null;
  }
}

function applyRewrite(memo: Memo, payload: RewritePayload, model: string): Memo {
  const byId = new Map((payload.sections ?? []).map((section) => [section.id, section]));
  const sections: MemoSection[] = memo.sections.map((section) => {
    const next = byId.get(section.id);
    if (!next) return section;
    return {
      ...section,
      paragraphs: sameLength(section.paragraphs, next.paragraphs),
      numbered: section.numbered ? sameLength(section.numbered, next.numbered) : undefined,
      bullets: section.bullets ? sameLength(section.bullets, next.bullets) : undefined,
      footer: section.footer ? sameLength(section.footer, next.footer) : undefined,
    };
  });
  const rationale = payload.rationale?.trim();
  const updated: Memo = {
    ...memo,
    sections,
    stanceRationale: rationale && rationale.length > 40 ? rationale : memo.stanceRationale,
    generationMode: "live-ai",
    model,
    generationNote: `Prose was rewritten by ${model}. Every figure in the rewrite had to already appear in the source pack or the rubric, and that check passed. The stance (${memo.stance}) was set by the written rubric, not by the model.`,
  };
  return { ...updated, markdown: renderMarkdown(updated) };
}

function sameLength(original: string[], incoming: string[] | undefined): string[] {
  if (!incoming || incoming.length !== original.length) return original;
  if (incoming.some((item) => !item.trim())) return original;
  return incoming.map((item) => item.trim());
}

function finish(memo: Memo, mode: Memo["generationMode"], note: string): Memo {
  const updated: Memo = { ...memo, generationMode: mode, generationNote: note, model: undefined };
  return { ...updated, markdown: renderMarkdown(updated) };
}
