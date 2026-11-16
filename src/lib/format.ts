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

const TH_DIGITS = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
const TH_PLACES = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน"];

function thaiInt(n: number): string {
  if (n >= 1_000_000) {
    const rest = n % 1_000_000;
    return thaiInt(Math.floor(n / 1_000_000)) + "ล้าน" + (rest === 1 ? "เอ็ด" : thaiInt(rest));
  }
  const s = String(n);
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const d = Number(s[i]);
    const place = s.length - i - 1;
    if (!d) continue;
    if (place === 1 && d === 1) out += "สิบ";
    else if (place === 1 && d === 2) out += "ยี่สิบ";
    else if (place === 0 && d === 1 && s.length > 1) out += "เอ็ด";
    else out += TH_DIGITS[d] + TH_PLACES[place];
  }
  return out;
}

/** 1250 → "หนึ่งพันสองร้อยห้าสิบบาทถ้วน" (ตัวอักษรกำกับยอดเงินในเอกสาร) */
export function bahtText(n: number) {
  const satang = Math.round(Math.abs(n) * 100);
  const b = Math.floor(satang / 100);
  const s = satang % 100;
  const sign = n < 0 ? "ลบ" : "";
  if (!b && !s) return "ศูนย์บาทถ้วน";
  return `${sign}${b ? thaiInt(b) + "บาท" : ""}${s ? thaiInt(s) + "สตางค์" : "ถ้วน"}`;
}
