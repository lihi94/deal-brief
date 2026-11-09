import { notFound } from "next/navigation";
import { MemoView } from "../../../components/memo-view";
import { getSample, samples } from "../../../lib/samples";

export function generateStaticParams() {
  return samples.map((sample) => ({ slug: sample.slug }));
}

export default async function SamplePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const sample = getSample(slug);
  if (!sample) notFound();
  return (
    <main className="shell">
      <header className="top no-print">
        <div>
          <p className="eyebrow">Checked-in sample</p>
          <h1 className="brand">Deal <span>Brief</span></h1>
        </div>
        <nav>
          <a href="/samples">All samples</a>
          <a href="/">New memo</a>
        </nav>
      </header>
      <MemoView memo={sample.bundle.memo} />
    </main>
  );
}
