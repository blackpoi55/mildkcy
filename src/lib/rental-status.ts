// สถานะการเช่า: กำหนดคืน / เลยกำหนด — ใช้ได้ทั้งฝั่ง server และ client
import { addDays, diffDays, thShort } from "./dates";
import { rentalTotal, type Rental } from "./schema";

/** วันที่คืนจริง (ข้อมูลเก่าที่ไม่มีวันที่คืน ถือว่าคืนวันเดียวกับวันที่ยืม) */
export function returnDateOf(r: Pick<Rental, "date" | "returnDate" | "returnTime">) {
  return r.returnTime ? r.returnDate || r.date : "";
}

/** "29 ต.ค. 69 12:12" — ใส่วันที่เสมอ ไม่งั้นคืนข้ามวันจะดูไม่ออก */
export function returnedText(r: Pick<Rental, "date" | "returnDate" | "returnTime">) {
  return r.returnTime ? `${thShort(returnDateOf(r))} ${r.returnTime}` : "";
}

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

/**
 * รถที่ออกไปแล้วและยังไม่คืน (1 รายการต่อการเช่า = วันล่าสุดที่ไม่เกินวันนี้)
 * ข้อมูลเก่าจาก Excel ที่ไม่มีกำหนดคืน นับเฉพาะรายการของวันนี้ ไม่งั้นจะค้างเป็น "ยังไม่คืน" ตลอดไป
 * เรียง: เลยกำหนดนานสุด → ใกล้ถึงกำหนด → ไม่มีกำหนด
 */
export function outstandingRentals(rentals: Rental[], today: string, now: string): Rental[] {
  const latest = new Map<string, Rental>();
  for (const r of rentals) {
    if (r.days <= 0 || r.returnTime || r.date > today) continue;
    if (!r.dueDate && lastDayOut(r, today) < today) continue;
    const key = `${r.bikeId}|${r.bookingId || r.id}`;
    const cur = latest.get(key);
    if (!cur || r.date > cur.date) latest.set(key, r);
  }
  const left = (r: Rental) => minutesUntilDue(r, today, now) ?? Infinity;
  return [...latest.values()].sort((a, b) => left(a) - left(b) || a.plate.localeCompare(b.plate));
}

/** รายการที่คืนรถในวันที่ day (1 รายการต่อการเช่า) เรียงตามเวลาคืนล่าสุดก่อน */
export function returnedOn(rentals: Rental[], day: string): Rental[] {
  const latest = new Map<string, Rental>();
  for (const r of rentals) {
    if (!r.returnTime || returnDateOf(r) !== day) continue;
    const key = `${r.bikeId}|${r.bookingId || r.id}`;
    const cur = latest.get(key);
    if (!cur || r.date > cur.date) latest.set(key, r);
  }
  return [...latest.values()].sort((a, b) => b.returnTime.localeCompare(a.returnTime));
}

// ---------------------------------------------------------------- เคสการเช่า (1 รายการ = เช่า 1 ครั้ง กี่วันก็ได้)

/** วันสุดท้ายที่คิดเงิน เช่น เช่า 28 จำนวน 2 วัน = 29 */
export function billingEnd(r: Pick<Rental, "date" | "days">) {
  return addDays(r.date, Math.max(1, Math.ceil(r.days)) - 1);
}

/**
 * วันสุดท้ายที่รถอยู่กับลูกค้า (รวมวันนั้น)
 * คืนแล้ว = วันที่คืนจริง · ยังไม่คืนและเลยวันสุดท้ายที่คิดเงิน = ถึงวันนี้ (ข้อมูลเก่าไม่มีกำหนดคืน ไม่ต้องลากยาว)
 */
export function lastDayOut(r: Pick<Rental, "date" | "days" | "dueDate" | "returnDate" | "returnTime">, today: string) {
  if (r.returnTime) return returnDateOf(r);
  const end = billingEnd(r);
  return r.dueDate && today > end ? today : end;
}

/** รายการนี้ทำให้รถไม่อยู่ที่ร้านในวัน day หรือไม่ */
export function coversDay(r: Rental, day: string, today: string) {
  return r.days > 0 && r.date <= day && day <= lastDayOut(r, today);
}

/** ลูกค้านำรถมาคืนในวัน day (การ์ดวันนั้นแสดงเป็น "คืนแล้ว") */
export function backOn(r: Rental, day: string) {
  return !!r.returnTime && returnDateOf(r) === day;
}

/** จำนวนวันที่ใช้จริง: นับทุก 24 ชม. จากเวลารับรถ (อย่างน้อย 1 วัน) */
export function usedDays(r: Pick<Rental, "date" | "time">, returnDate: string, returnTime: string) {
  const [h1, m1] = (r.time || "00:00").split(":").map(Number);
  const [h2, m2] = (returnTime || "00:00").split(":").map(Number);
  const minutes = diffDays(r.date, returnDate) * 1440 + (h2 * 60 + m2) - (h1 * 60 + m1);
  return Math.max(1, Math.ceil(minutes / 1440));
}

export type DayPlan =
  | { kind: "none" }
  | { kind: "create" }
  /** ต่อการเช่าเดิมอีก 1 วัน / ลดวันสุดท้าย / เลื่อนวันแรก */
  | { kind: "extend" | "shrink" | "shift"; target: Rental }
  | { kind: "remove"; target: Rental }
  /** แก้ด้วยการติ๊กไม่ได้ (ต้องเปิดแก้ไขรายการ) */
  | { kind: "blocked"; target: Rental; reason: string };

/**
 * ติ๊ก/ยกเลิกวันเช่าในตาราง ทำอะไรกับเคสการเช่า (ใช้ร่วมกันทั้งหน้าเว็บและ server)
 * rows = รายการของรถคันนี้
 */
export function planDay(rows: Rental[], day: string, rented: boolean, today: string): DayPlan {
  const covering = rows.filter((r) => coversDay(r, day, today));
  if (rented) {
    if (covering.some((r) => !r.returnTime)) return { kind: "none" };
    const prev = rows.find((r) => r.days > 0 && !r.returnTime && billingEnd(r) === addDays(day, -1));
    return prev ? { kind: "extend", target: prev } : { kind: "create" };
  }
  const c = covering.find((r) => !r.returnTime) ?? covering[0];
  if (!c) return { kind: "none" };
  const end = billingEnd(c);
  if (c.date === day && end === day) return { kind: "remove", target: c };
  if (c.returnTime) return { kind: "blocked", target: c, reason: `${c.plate} คืนรถแล้ว — แก้จำนวนวันในหน้าต่างแก้ไข` };
  if (day > end) return { kind: "blocked", target: c, reason: `${c.plate} ยังไม่คืนรถ (เลยกำหนด) — กดคืนรถที่แท็บ “คืนรถ”` };
  if (day === end) return { kind: "shrink", target: c };
  if (day === c.date) return { kind: "shift", target: c };
  return { kind: "blocked", target: c, reason: `วันนี้อยู่กลางการเช่า ${c.days} วัน — แก้จำนวนวันในหน้าต่างแก้ไข` };
}

/** เคสหลังต่อ/ลด/เลื่อนวัน 1 วัน */
export function resized(r: Rental, kind: "extend" | "shrink" | "shift"): Rental {
  const n: Rental =
    kind === "extend"
      ? { ...r, days: r.days + 1, dueDate: r.dueDate && addDays(r.dueDate, 1) }
      : kind === "shrink"
        ? { ...r, days: r.days - 1, dueDate: r.dueDate && addDays(r.dueDate, -1) }
        : { ...r, date: addDays(r.date, 1), days: r.days - 1 };
  return { ...n, total: rentalTotal(n) };
}
