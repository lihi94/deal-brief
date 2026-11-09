import { samples } from "../../lib/samples";

export default function SamplesPage() {
  return (
    <main className="shell">
      <header className="top">
        <div>
          <p className="eyebrow">Checked-in samples</p>
          <h1 className="brand">Deal <span>Brief</span></h1>
        </div>
        <nav className="no-print">
          <a href="/">New memo</a>
        </nav>
      </header>
      <p className="lede page-intro">
        These three memos were captured from public sources and checked in so the desk still reads when no API key is set. They are not live fetches.
      </p>
      <div className="sample-grid">
        {samples.map((sample) => (
          <a key={sample.slug} className="sample-card" href={`/samples/${sample.slug}`}>
            <p className="eyebrow">{sample.trackLabel}</p>
            <h3>{sample.title}</h3>
            <p>{sample.summary}</p>
          </a>
        ))}
      </div>
    </main>
  );
}
