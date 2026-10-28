const baht0 = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 2 });

export function baht(n: number) {
  return `฿${baht0.format(n)}`;
}

export function number(n: number, digits = 0) {
  return new Intl.NumberFormat("th-TH", { maximumFractionDigits: digits }).format(n);
}

export function compactBaht(n: number) {
  if (Math.abs(n) >= 1_000_000) return `฿${number(n / 1_000_000, 1)}M`;
  if (Math.abs(n) >= 10_000) return `฿${number(n / 1000, 1)}k`;
  return baht(n);
}

export function pctChange(cur: number, prev: number) {
  if (!prev) return null;
  return ((cur - prev) / prev) * 100;
}
