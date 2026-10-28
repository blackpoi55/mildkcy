// วันที่ทั้งหมดเก็บเป็นสตริง ISO "YYYY-MM-DD" (เวลาไทย) เพื่อไม่ให้เพี้ยนเรื่อง timezone

export type Period = "day" | "week" | "month";

const TZ = "Asia/Bangkok";

export function todayISO() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

export function nowTime() {
  return new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(
    new Date(),
  );
}

function parse(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fmt(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function addDays(iso: string, n: number) {
  const d = parse(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return fmt(d);
}

export function addMonths(iso: string, n: number) {
  const d = parse(iso);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return fmt(d);
}

export function dayOfWeek(iso: string) {
  return parse(iso).getUTCDay();
}

/** สัปดาห์เริ่มวันอาทิตย์ (เหมือนตารางใน Excel) */
export function startOfWeek(iso: string) {
  return addDays(iso, -dayOfWeek(iso));
}

export function startOfMonth(iso: string) {
  return iso.slice(0, 8) + "01";
}

export function daysInMonth(iso: string) {
  const d = parse(iso);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
}

export function diffDays(a: string, b: string) {
  return Math.round((parse(b).getTime() - parse(a).getTime()) / 86_400_000);
}

export function rangeOf(period: Period, iso: string): { start: string; end: string; days: string[] } {
  const start = period === "day" ? iso : period === "week" ? startOfWeek(iso) : startOfMonth(iso);
  const len = period === "day" ? 1 : period === "week" ? 7 : daysInMonth(iso);
  const days = Array.from({ length: len }, (_, i) => addDays(start, i));
  return { start, end: days[days.length - 1], days };
}

export function shift(period: Period, iso: string, dir: number) {
  if (period === "day") return addDays(iso, dir);
  if (period === "week") return addDays(iso, 7 * dir);
  return addMonths(startOfMonth(iso), dir);
}

export const TH_DAYS_SHORT = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
export const TH_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];
export const TH_MONTHS_SHORT = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

function parts(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m, d, be: y + 543 };
}

/** 28 ต.ค. 69 */
export function thShort(iso: string) {
  if (!iso) return "-";
  const { m, d, be } = parts(iso);
  return `${d} ${TH_MONTHS_SHORT[m - 1]} ${String(be).slice(2)}`;
}

/** 28 ตุลาคม 2569 */
export function thLong(iso: string) {
  const { m, d, be } = parts(iso);
  return `${d} ${TH_MONTHS[m - 1]} ${be}`;
}

export function thMonth(iso: string) {
  const { m, be } = parts(iso);
  return `${TH_MONTHS[m - 1]} ${be}`;
}

export function periodLabel(period: Period, iso: string) {
  if (period === "day") return `${TH_DAYS_SHORT[dayOfWeek(iso)]} ${thLong(iso)}`;
  if (period === "month") return thMonth(iso);
  const { start, end } = rangeOf("week", iso);
  return `${thShort(start)} – ${thShort(end)}`;
}

export function isISODate(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}
