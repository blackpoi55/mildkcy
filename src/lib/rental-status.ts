// สถานะการเช่า: กำหนดคืน / เลยกำหนด — ใช้ได้ทั้งฝั่ง server และ client
import { addDays, diffDays, thShort } from "./dates";
import type { Rental } from "./schema";

/** "วันนี้ 18:00" / "พรุ่งนี้ 10:45" / "31 ต.ค. 69 10:45" */
export function dueText(dueDate: string, dueTime: string, today: string) {
  if (!dueDate) return "";
  const day =
    dueDate === today ? "วันนี้" : dueDate === addDays(today, 1) ? "พรุ่งนี้" : dueDate === addDays(today, -1) ? "เมื่อวาน" : thShort(dueDate);
  return `${day}${dueTime ? ` ${dueTime}` : ""}`;
}

function minutesOf(date: string, time: string) {
  const [h, m] = (time || "23:59").split(":").map(Number);
  return diffDays("2000-01-01", date) * 1440 + h * 60 + m;
}

/** จำนวนนาทีที่เลยกำหนดคืน (0 = ยังไม่เลย / คืนแล้ว / ไม่มีกำหนด) */
export function overdueMinutes(r: Pick<Rental, "dueDate" | "dueTime" | "returnTime">, today: string, now: string) {
  if (!r.dueDate || r.returnTime) return 0;
  return Math.max(0, minutesOf(today, now) - minutesOf(r.dueDate, r.dueTime));
}

/** นาทีที่เหลือก่อนถึงกำหนดคืน (ติดลบ = เลยแล้ว, null = ไม่มีกำหนด) */
export function minutesUntilDue(r: Pick<Rental, "dueDate" | "dueTime">, today: string, now: string) {
  if (!r.dueDate) return null;
  return minutesOf(r.dueDate, r.dueTime) - minutesOf(today, now);
}

/** 135 → "2 ชม. 15 นาที", 1600 → "1 วัน 2 ชม." */
export function durationText(min: number) {
  const d = Math.floor(min / 1440);
  const h = Math.floor((min % 1440) / 60);
  const m = min % 60;
  if (d) return `${d} วัน${h ? ` ${h} ชม.` : ""}`;
  if (h) return `${h} ชม.${m ? ` ${m} นาที` : ""}`;
  return `${m} นาที`;
}

export type DueItem = { rental: Rental; left: number };

/**
 * รถที่ยังไม่คืนและใกล้ถึง/เลยกำหนดคืน (ภายใน withinMin นาที) — 1 รายการต่อการเช่า
 * เรียงจากเลยกำหนดนานสุด → ใกล้ถึงเวลาที่สุด
 */
export function dueSoonList(rentals: Rental[], today: string, now: string, withinMin = 24 * 60): DueItem[] {
  const latest = new Map<string, Rental>();
  for (const r of rentals) {
    if (r.returnTime || !r.dueDate || r.days <= 0 || r.date > today) continue;
    const key = `${r.bikeId}|${r.bookingId || r.id}`;
    const cur = latest.get(key);
    if (!cur || r.date > cur.date) latest.set(key, r);
  }
  return [...latest.values()]
    .map((rental) => ({ rental, left: minutesUntilDue(rental, today, now) ?? Infinity }))
    .filter((x) => x.left <= withinMin)
    .sort((a, b) => a.left - b.left);
}
