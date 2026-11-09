import type { Bundle } from "./generate";
import nvidiaJson from "../data/samples/nvidia.json";
import wixJson from "../data/samples/wix.json";
import wizJson from "../data/samples/wiz.json";

export type Sample = {
  slug: string;
  title: string;
  trackLabel: string;
  summary: string;
  bundle: Bundle;
};

export const samples: Sample[] = [
  {
    slug: "wix",
    title: "Wix",
    trackLabel: "Public company",
    summary: "Watch, high conviction, if gross margin and cash generation are real but the fiscal operating margin is near zero and book equity is negative.",
    bundle: wixJson as Bundle,
  },
  {
    slug: "nvidia",
    title: "NVIDIA",
    trackLabel: "Public company",
    summary: "Watch if the filing is exceptional and market cap / last-fiscal revenue is still above the 15× ceiling.",
    bundle: nvidiaJson as Bundle,
  },
  {
    slug: "wiz",
    title: "Wiz",
    trackLabel: "Startup / VC",
    summary: "Diligence further from the company site. Funding, headcount, and valuation stay Unknown.",
    bundle: wizJson as Bundle,
  },
];

export function getSample(slug: string): Sample | undefined {
  return samples.find((sample) => sample.slug === slug);
}
