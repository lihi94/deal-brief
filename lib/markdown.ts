import type { Memo, MemoSection } from "./types";

type MemoBody = Omit<Memo, "markdown">;
import { formatGeneratedDate } from "./format";

function sectionMarkdown(section: MemoSection): string {
  const lines = [`## ${section.heading}`, ""];
  for (const paragraph of section.paragraphs) lines.push(paragraph, "");
  if (section.quotes) {
    for (const quote of section.quotes) {
      lines.push(`> ${quote.text}`, "", `_${quote.note}_`, "");
    }
  }
  if (section.table) {
    lines.push(`_${section.table.caption}_`, "");
    lines.push(`| ${section.table.columns.join(" | ")} |`);
    lines.push(`| ${section.table.columns.map(() => "---").join(" | ")} |`);
    for (const row of section.table.rows) lines.push(`| ${row.join(" | ")} |`);
    lines.push("");
  }
  if (section.numbered) {
    section.numbered.forEach((item, index) => lines.push(`${index + 1}. ${item}`, ""));
  }
  if (section.bullets) {
    for (const bullet of section.bullets) lines.push(`- ${bullet}`);
    lines.push("");
  }
  if (section.footer) {
    for (const paragraph of section.footer) lines.push(paragraph, "");
  }
  return lines.join("\n");
}

export function renderMarkdown(memo: MemoBody): string {
  const title = memo.ticker ? `${memo.subject} (${memo.ticker})` : memo.subject;
  const lines = [
    `# Deal Brief — ${title}`,
    "",
    `${memo.track === "public" ? "Public-company screening memo" : "Startup / VC screening memo"} · ${formatGeneratedDate(memo.generatedAt)}`,
    "",
    `**Stance: ${memo.stance}** · conviction ${memo.conviction}`,
    "",
    memo.stanceRationale,
    "",
    `_${memo.generationNote}_`,
    "",
    ...memo.sections.map(sectionMarkdown),
    "## Sources",
    "",
    ...memo.sources.map((source) => `- ${source.name}: ${source.url} (retrieved ${source.retrievedAt})`),
    "",
    "## Disclaimer",
    "",
    memo.disclaimer,
    "",
  ];
  return lines.join("\n");
}
