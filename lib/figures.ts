const FIGURE_RE =
  /\$\s?\d+(?:,\d{3})*(?:\.\d+)?|\d{1,3}(?:,\d{3})+(?:\.\d+)?|\b\d{6,}\b|\d+\.\d+|\d+(?:\.\d+)?\s*(?:%|×|x\b|billion|million|trillion)|\b(?:19|20)\d{2}\b/gi;

export function figureValues(text: string): number[] {
  const values: number[] = [];
  for (const match of text.matchAll(FIGURE_RE)) {
    const token = match[0].toLowerCase();
    const numeric = token.replace(/[$,\s]|%|×|x|billion|million|trillion/g, "");
    const value = Number(numeric);
    if (Number.isFinite(value)) values.push(value);
  }
  return values;
}

export function collectNumbers(value: unknown, skipKey = "notes"): number[] {
  const numbers: number[] = [];
  const walk = (node: unknown, key?: string) => {
    if (key === skipKey) return;
    if (typeof node === "number" && Number.isFinite(node)) {
      numbers.push(node);
      return;
    }
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    if (node && typeof node === "object") {
      for (const [childKey, child] of Object.entries(node)) walk(child, childKey);
    }
  };
  walk(value);
  return numbers;
}

function isAllowed(value: number, allow: number[]): boolean {
  return allow.some((candidate) => {
    const gap = Math.abs(candidate - value);
    const scale = Math.max(Math.abs(candidate), Math.abs(value), 1);
    return gap <= 1e-6 || gap / scale <= 1e-4;
  });
}

export function unexpectedFigures(draft: string, allowText: string, extra: number[] = []): number[] {
  const allow = [...figureValues(allowText), ...extra];
  const unexpected: number[] = [];
  for (const value of figureValues(draft)) {
    if (!isAllowed(value, allow) && !unexpected.some((seen) => Math.abs(seen - value) <= 1e-9)) unexpected.push(value);
  }
  return unexpected;
}
