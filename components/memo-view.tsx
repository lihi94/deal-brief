"use client";

import type { Memo, MemoSection } from "../lib/types";
import { formatGeneratedDate, memoFilename } from "../lib/format";

export function MemoView({ memo }: { memo: Memo }) {
  const title = memo.ticker ? `${memo.subject} (${memo.ticker})` : memo.subject;
  const stampClass = stampClassName(memo.stance);
  return (
    <article className="memo">
      <header className="memo-head">
        <div>
          <p className="kicker">{memo.track === "public" ? "Public-company screening memo" : "Startup / VC screening memo"}</p>
          <h2>{title}</h2>
          <p className="hint">Generated {formatGeneratedDate(memo.generatedAt)}</p>
        </div>
        <div className={`stamp ${stampClass}`} aria-label={`Stance ${memo.stance}`}>
          <b>{memo.stance}</b>
          <small>{memo.conviction} conviction</small>
        </div>
      </header>
      <p className="banner">{memo.generationNote}</p>
      <p className="rationale">{memo.stanceRationale}</p>
      {memo.sections.map((section) => (
        <SectionView key={section.id} section={section} />
      ))}
      <section>
        <h3>Sources</h3>
        <ul className="sources">
          {memo.sources.length ? memo.sources.map((source) => (
            <li key={source.url}>
              {source.name}: <a href={source.url}>{source.url}</a>
              <div>Retrieved {source.retrievedAt}</div>
            </li>
          )) : <li>No sources were retrieved.</li>}
        </ul>
      </section>
      <p className="disclaimer">{memo.disclaimer}</p>
      <div className="row no-print">
        <button type="button" className="ghost" onClick={() => window.print()}>Print</button>
        <button type="button" className="ghost" onClick={() => downloadMarkdown(memo)}>Download Markdown</button>
      </div>
    </article>
  );
}

function SectionView({ section }: { section: MemoSection }) {
  return (
    <section>
      <h3>{section.heading}</h3>
      {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
      {section.quotes?.map((quote) => (
        <div key={quote.text}>
          <blockquote>{quote.text}</blockquote>
          <p className="quote-note">{quote.note}</p>
        </div>
      ))}
      {section.table ? (
        <div className="table-wrap">
          <table>
            <caption>{section.table.caption}</caption>
            <thead>
              <tr>{section.table.columns.map((column) => <th key={column} scope="col">{column}</th>)}</tr>
            </thead>
            <tbody>
              {section.table.rows.map((row) => (
                <tr key={row.join("|")}>
                  {row.map((cell, index) => index === 0 ? <th key={cell} scope="row">{cell}</th> : <td key={`${row[0]}-${index}`}>{cell}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {section.numbered ? (
        <ol>{section.numbered.map((item) => <li key={item}>{item}</li>)}</ol>
      ) : null}
      {section.bullets ? (
        <ul>{section.bullets.map((item) => <li key={item}>{item}</li>)}</ul>
      ) : null}
      {section.footer?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
    </section>
  );
}

function stampClassName(stance: string): string {
  if (stance === "Attractive") return "stance-Attractive";
  if (stance === "Watch") return "stance-Watch";
  if (stance === "Pass") return "stance-Pass";
  if (stance === "Diligence further") return "stance-Diligence";
  return "stance-Need";
}

function downloadMarkdown(memo: Memo) {
  const blob = new Blob([memo.markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = memoFilename(memo.subject, memo.ticker, memo.generatedAt);
  link.click();
  URL.revokeObjectURL(url);
}
