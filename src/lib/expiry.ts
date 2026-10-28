import { diffDays, thShort } from "./dates";

/** สถานะวันหมดอายุ: หมดแล้ว / ใกล้หมด (≤ 30 วัน) / ปกติ — มีไอคอน+ข้อความเสมอ ไม่ใช้สีอย่างเดียว */
export function expiryState(date: string, today: string) {
  if (!date || !/^\d{4}-/.test(date)) return null;
  const left = diffDays(today, date);
  if (left < 0) return { tone: "bad" as const, left, label: `หมดแล้ว ${-left} วัน` };
  if (left <= 30) return { tone: "warn" as const, left, label: `อีก ${left} วัน` };
  return { tone: "good" as const, left, label: thShort(date) };
}
