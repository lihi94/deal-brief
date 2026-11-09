const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatUsdExact(value: number): string {
  const sign = value < 0 ? "-" : "";
  return `${sign}$${Math.abs(Math.round(value)).toLocaleString("en-US")}`;
}

export function formatUsd(value: number): string {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  const exact = `${sign}$${Math.round(abs).toLocaleString("en-US")}`;
  if (abs >= 1e12) return `${exact} (${sign}$${(abs / 1e12).toFixed(2)} trillion)`;
  if (abs >= 1e9) return `${exact} (${sign}$${(abs / 1e9).toFixed(2)} billion)`;
  if (abs >= 1e6) return `${exact} (${sign}$${(abs / 1e6).toFixed(1)} million)`;
  return exact;
}

export function formatUsdShort(value: number): string {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(2)} trillion`;
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)} billion`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)} million`;
  return `${sign}$${abs.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

export function formatPct(ratio: number): string {
  const pct = ratio * 100;
  const digits = Math.abs(pct) < 1 && pct !== 0 ? 2 : 1;
  return `${pct.toFixed(digits)}%`;
}

export function formatMultiple(value: number): string {
  return `${value.toFixed(2)}×`;
}

export function formatShares(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export function periodLabel(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (!match) return isoDate;
  const day = Number(match[3]);
  const month = MONTHS[Number(match[2]) - 1] ?? match[2];
  return `${day} ${month} ${match[1]}`;
}

export function formatTimestamp(iso: string, timeZone = "America/New_York"): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const formatted = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
  return `${formatted} ${timeZone === "UTC" ? "UTC" : timeZone}`;
}

export function formatGeneratedDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function unixSecondsToIso(seconds: number): string {
  return new Date(seconds * 1000).toISOString();
}

export function memoFilename(subject: string, ticker: string | undefined, generatedAt: string): string {
  const name = slugify(ticker ?? subject) || "memo";
  return `deal-brief-${name}-${formatGeneratedDate(generatedAt).replace(/\s+/g, "-").toLowerCase()}.md`;
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

export function firstSentence(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  const match = /^(.{40,}?[.])(?:\s|$)/.exec(clean);
  return (match?.[1] ?? clean).slice(0, 420);
}
