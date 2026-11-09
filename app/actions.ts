"use server";

import { generateMemo } from "../lib/generate";
import type { GenerateInput, Memo } from "../lib/types";

export async function createMemo(input: GenerateInput): Promise<Memo> {
  const query = input.query?.trim().replace(/\s+/g, " ") ?? "";
  if (!query) throw new Error("Enter a company name or ticker.");
  if (query.length > 80) throw new Error("Keep the company name under 80 characters.");
  if (input.track !== "public" && input.track !== "startup") throw new Error("Choose a track.");
  return generateMemo({
    track: input.track,
    query,
    website: input.website,
    notes: input.notes,
  });
}
