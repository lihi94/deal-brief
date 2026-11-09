import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { generateMemoBundle } from "../lib/generate";

const jobs = [
  { slug: "wix", track: "public" as const, query: "WIX" },
  { slug: "nvidia", track: "public" as const, query: "NVDA" },
  { slug: "wiz", track: "startup" as const, query: "Wiz", website: "https://www.wiz.io" },
];

async function main() {
  const dir = resolve(process.cwd(), "data/samples");
  mkdirSync(dir, { recursive: true });
  for (const job of jobs) {
    process.stdout.write(`capturing ${job.slug}...\n`);
    const bundle = await generateMemoBundle(
      { track: job.track, query: job.query, website: job.website },
      { sample: true },
    );
    const file = resolve(dir, `${job.slug}.json`);
    writeFileSync(file, `${JSON.stringify(bundle, null, 2)}\n`);
    process.stdout.write(`${dirname(file)}/${job.slug}.json stance=${bundle.memo.stance} conviction=${bundle.memo.conviction}\n`);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
