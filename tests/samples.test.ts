import { describe, expect, it } from "vitest";
import { DISCLAIMER } from "../lib/constants";
import { buildMemo } from "../lib/memo";
import { judge } from "../lib/rubric";
import { samples } from "../lib/samples";

describe("checked-in samples", () => {
  it("reproduces the stored stance from the stored source pack", () => {
    for (const sample of samples) {
      const judgment = judge(sample.bundle.context);
      expect(judgment.stance).toBe(sample.bundle.memo.stance);
      const rebuilt = buildMemo(sample.bundle.context, judgment, {
        now: new Date(sample.bundle.memo.generatedAt),
        mode: "sample",
        id: sample.bundle.memo.id,
      });
      expect(rebuilt.stance).toBe(sample.bundle.memo.stance);
      expect(rebuilt.conviction).toBe(sample.bundle.memo.conviction);
      expect(sample.bundle.memo.disclaimer).toBe(DISCLAIMER);
      expect(sample.bundle.memo.markdown).toContain(DISCLAIMER);
      expect(JSON.stringify(sample.bundle)).not.toMatch(/sk-ant-|ANTHROPIC_API_KEY=sk/);
    }
  });

  it("keeps the worked examples on the rubric", () => {
    const wix = samples.find((sample) => sample.slug === "wix");
    const nvidia = samples.find((sample) => sample.slug === "nvidia");
    const wiz = samples.find((sample) => sample.slug === "wiz");
    expect(wix?.bundle.memo.stance).toBe("Watch");
    expect(wix?.bundle.memo.conviction).toBe("high");
    expect(wix?.bundle.memo.markdown).toContain("0.09%");
    expect(nvidia?.bundle.memo.stance).toBe("Watch");
    expect(nvidia?.bundle.memo.markdown).toContain("15×");
    expect(wiz?.bundle.memo.stance).toBe("Diligence further");
    expect(wiz?.bundle.memo.markdown).toMatch(/Fortune 100/i);
    expect(wiz?.bundle.memo.markdown).toContain("Funding: Unknown");
    expect(wiz?.bundle.memo.markdown).toContain("Valuation: Unknown");
    expect(wiz?.bundle.memo.markdown).toContain("Headcount: Unknown");
  });
});
