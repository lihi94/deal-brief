import { Screener } from "../components/screener";
import { samples } from "../lib/samples";

export default function HomePage() {
  return (
    <main className="shell">
      <header className="top">
        <div>
          <p className="eyebrow">Screening desk</p>
          <h1 className="brand">Deal <span>Brief</span></h1>
        </div>
        <nav className="no-print">
          <a href="#screen">New memo</a>
          <a href="/samples">Sample memos</a>
        </nav>
      </header>
      <p className="lede">
        A one-page screening memo for a public company or a startup. Figures come from the sources named in the note. The stance comes from a written rubric. Missing data stays Unknown.
      </p>
      <div id="screen" className="no-print">
        <Screener />
      </div>
      <section className="no-print">
        <p className="eyebrow">Checked-in samples</p>
        <div className="sample-grid">
          {samples.map((sample) => (
            <a key={sample.slug} className="sample-card" href={`/samples/${sample.slug}`}>
              <p className="eyebrow">{sample.trackLabel}</p>
              <h3>{sample.title}</h3>
              <p>{sample.bundle.memo.stance} · {sample.bundle.memo.conviction} conviction</p>
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}
