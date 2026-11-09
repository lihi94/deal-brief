import { gather } from "./gather";
import { maybeRewrite } from "./llm";
import { buildMemo } from "./memo";
import { judge } from "./rubric";
import type { GenerateInput, Memo, ResearchContext } from "./types";

export type Bundle = { memo: Memo; context: ResearchContext };

export async function generateMemoBundle(
  input: GenerateInput,
  options: { sample?: boolean; now?: Date } = {},
): Promise<Bundle> {
  const now = options.now ?? new Date();
  const context = await gather(input, now);
  const judgment = judge(context);
  const memo = buildMemo(context, judgment, {
    now,
    mode: options.sample ? "sample" : "template",
  });
  if (options.sample) return { memo, context };
  return { memo: await maybeRewrite(memo, context), context };
}

export async function generateMemo(input: GenerateInput): Promise<Memo> {
  const bundle = await generateMemoBundle(input);
  return bundle.memo;
}
