"use server";

import { promises as fs } from "node:fs";
import path from "node:path";
import { cookies } from "next/headers";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { AUTH_COOKIE, authToken, isValidToken } from "@/lib/auth";
import { getSettings } from "@/lib/data";
import type { LaundryPrice } from "@/lib/laundry";
import { addDays, diffDays, isISODate, nowTime } from "@/lib/dates";
import { bookingOf, rentalTotal, type Bike, type Laundry, type Rental } from "@/lib/schema";
import { getStore, newId } from "@/lib/store";

export type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

async function guard<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    if (!(await isValidToken((await cookies()).get(AUTH_COOKIE)?.value))) {
      return { ok: false, error: "กรุณาเข้าสู่ระบบใหม่" };
    }
    const data = await fn();
    refresh();
    return { ok: true, data };
  } catch (e) {
    console.error(e);
    return { ok: false, error: e instanceof Error ? e.message : "เกิดข้อผิดพลาด" };
  }
}

const now = () => new Date().toISOString();
const num = (v: unknown) => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : 0;
};
const str = (v: unknown) => String(v ?? "").trim();

// ---------------------------------------------------------------- เข้าสู่ระบบ

export async function login(_: string | null, form: FormData) {
  const password = str(form.get("password"));
  if (!process.env.APP_PASSWORD || password !== process.env.APP_PASSWORD) return "รหัสผ่านไม่ถูกต้อง";
  (await cookies()).set(AUTH_COOKIE, await authToken(password), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 90,
    path: "/",
  });
  const next = str(form.get("next"));
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export async function logout() {
  (await cookies()).delete(AUTH_COOKIE);
  redirect("/login");
}

// ---------------------------------------------------------------- รถ

export async function saveBike(input: Partial<Bike>) {
  return guard(async () => {
    const plate = str(input.plate);
    if (!plate) throw new Error("กรุณากรอกทะเบียนรถ");
    const store = getStore();
    const bikes = await store.all("bikes");
    if (bikes.some((b) => b.plate === plate && b.id !== input.id)) throw new Error(`ทะเบียน ${plate} มีอยู่แล้ว`);
    const row: Bike = {
      id: input.id || newId(),
      brand: str(input.brand).toUpperCase(),
      model: str(input.model),
      plate,
      province: str(input.province),
      source: str(input.source),
      taxExpiry: str(input.taxExpiry),
      owner: str(input.owner),
      cardExpiry: str(input.cardExpiry),
      transferKit: str(input.transferKit),
      transferTo: str(input.transferTo),
      status: str(input.status) || "เช่า",
      dailyRate: num(input.dailyRate),
      note: str(input.note),
      createdAt: input.createdAt || now(),
    };
    if (input.id) {
      await store.update("bikes", input.id, row);
      // ทะเบียนเปลี่ยน → อัปเดตบันทึกเช่าที่ผูกกับรถคันนี้ด้วย
      const old = bikes.find((b) => b.id === input.id);
      if (old && old.plate !== plate) {
        const rentals = (await store.all("rentals")).filter((r) => r.bikeId === input.id);
        await store.updateMany("rentals", rentals.map((r) => ({ id: r.id, patch: { plate } })));
      }
    } else {
      await store.insert("bikes", [row]);
    }
  });
}

export async function deleteBike(id: string) {
  return guard(async () => {
    const used = (await getStore().all("rentals")).some((r) => r.bikeId === id);
    if (used) throw new Error("รถคันนี้มีประวัติการเช่าอยู่ เปลี่ยนสถานะเป็น 'ขายแล้ว' แทนการลบ");
    await getStore().remove("bikes", [id]);
  });
}

// ---------------------------------------------------------------- เช่ารถ

const TIME_RE = /^\d{1,2}:\d{2}$/;

function newRental(bike: Bike, fields: Partial<Rental> & { date: string }): Rental {
  const r: Rental = {
    id: newId(),
    date: fields.date,
    time: str(fields.time),
    dueDate: str(fields.dueDate),
    dueTime: str(fields.dueTime),
    returnTime: "",
    bookingId: fields.bookingId || newId(),
    bikeId: bike.id,
    plate: bike.plate,
    days: 1,
    price: fields.price ?? bike.dailyRate,
    discount: 0,
    fine: 0,
    total: 0,
    customer: str(fields.customer),
    note: str(fields.note),
    createdAt: now(),
  };
  r.total = rentalTotal(r);
  return r;
}

/**
 * ติ๊ก/ยกเลิก การเช่ารถ 1 คันใน 1 วัน (ตารางสัปดาห์ / ยกเลิกในหน้ารายวัน)
 * ถ้าเมื่อวานรถคันนี้ยังเช่าอยู่ (ยังไม่คืน) จะนับเป็นการเช่าต่อเนื่อง ใช้ลูกค้า/กำหนดคืนเดิม
 * คืนค่ารายการที่ถูกลบ/สร้าง เพื่อให้หน้าเว็บกด "เลิกทำ" ได้
 */
export async function setRentalDay(input: { bikeId: string; date: string; rented: boolean; time?: string }) {
  return guard(async (): Promise<Rental[]> => {
    if (!isISODate(input.date)) throw new Error("วันที่ไม่ถูกต้อง");
    const store = getStore();
    const all = await store.all("rentals");
    const existing = all.filter((r) => r.bikeId === input.bikeId && r.date === input.date);
    if (!input.rented) {
      // วันเดียวมีได้หลายรอบ (คืนแล้วเช่าต่อคนใหม่) — ยกเลิกเฉพาะรอบที่ยังไม่คืนก่อน
      const active = existing.filter((r) => !r.returnTime);
      const target = active.length ? active : existing;
      if (target.length) await store.remove("rentals", target.map((r) => r.id));
      return target;
    }
    if (existing.length) return [];
    const bike = (await store.all("bikes")).find((b) => b.id === input.bikeId);
    if (!bike) throw new Error("ไม่พบรถคันนี้");
    const prev = all.find(
      (r) => r.bikeId === bike.id && r.date === addDays(input.date, -1) && r.days > 0 && !r.returnTime,
    );
    const time = str(input.time) || prev?.time || nowTime();
    const r = prev
      ? newRental(bike, {
          date: input.date,
          time: prev.time,
          bookingId: bookingOf(prev),
          customer: prev.customer,
          price: prev.price,
          dueDate: prev.dueDate && prev.dueDate >= input.date ? prev.dueDate : addDays(input.date, 1),
          dueTime: prev.dueTime || prev.time,
        })
      : newRental(bike, { date: input.date, time, dueDate: addDays(input.date, 1), dueTime: time });
    await store.insert("rentals", [r]);
    return [r];
  });
}

/**
 * เช่ารถพร้อมกำหนดคืน — เช่าหลายวันจะสร้างบันทึกให้ทุกวัน (คิดเงินรายวันเหมือนใน Excel)
 * เช่น เช่า 28 ต.ค. คืน 31 ต.ค. = 3 วัน (28, 29, 30)
 */
export async function createBooking(input: {
  bikeId: string;
  date: string;
  time: string;
  dueDate: string;
  dueTime: string;
  customer?: string;
  note?: string;
  discount?: number;
  fine?: number;
}) {
  return guard(async (): Promise<Rental[]> => {
    if (!isISODate(input.date) || !isISODate(input.dueDate)) throw new Error("วันที่ไม่ถูกต้อง");
    const discount = num(input.discount);
    const fine = num(input.fine);
    if (discount < 0 || fine < 0) throw new Error("ส่วนลด / ค่าปรับ ต้องไม่ติดลบ");
    if (!TIME_RE.test(input.time) || !TIME_RE.test(input.dueTime)) throw new Error("เวลาไม่ถูกต้อง");
    if (input.dueDate < input.date) throw new Error("วันคืนต้องไม่ก่อนวันเช่า");
    const days = Math.max(1, diffDays(input.date, input.dueDate));
    if (days > 60) throw new Error("เช่าได้ไม่เกิน 60 วันต่อครั้ง");
    const store = getStore();
    const bike = (await store.all("bikes")).find((b) => b.id === input.bikeId);
    if (!bike) throw new Error("ไม่พบรถคันนี้");
    const dates = Array.from({ length: days }, (_, i) => addDays(input.date, i));
    // ชนกันเฉพาะรอบที่ยังไม่คืน — คืนแล้วเช่าต่อคนใหม่ในวันเดียวกันได้
    const clash = (await store.all("rentals")).find(
      (r) => r.bikeId === bike.id && dates.includes(r.date) && r.days > 0 && !r.returnTime,
    );
    if (clash) throw new Error(`${bike.plate} ยังไม่ได้คืนรถของการเช่าวันที่ ${clash.date}`);
    const bookingId = newId();
    const rows = dates.map((date, i) => {
      const r = newRental(bike, {
        date,
        time: input.time,
        dueDate: input.dueDate,
        dueTime: input.dueTime,
        bookingId,
        customer: input.customer,
        note: input.note,
      });
      // ส่วนลด/ค่าปรับของทั้งการเช่า เก็บไว้ที่วันแรก (เหมือนใน Excel ที่ใส่ไว้แถวเดียว)
      if (i === 0 && (discount || fine)) {
        r.discount = discount;
        r.fine = fine;
        r.total = rentalTotal(r);
      }
      return r;
    });
    await store.insert("rentals", rows);
    return rows;
  });
}

/**
 * ลูกค้านำรถมาคืน (time = null คือยกเลิกการคืน)
 * removeFuture: คืนก่อนกำหนด → ลบบันทึกของวันที่ยังไม่ถึงออก (ไม่คิดเงิน) และส่งกลับไปให้กดเลิกทำได้
 */
export async function setReturned(
  id: string,
  time: string | null,
  removeFuture = false,
  extras?: { discount?: number; fine?: number; note?: string },
) {
  return guard(async (): Promise<{ time: string; removed: Rental[]; before: Rental | null }> => {
    const t = time === null ? "" : str(time) || nowTime();
    if (t && !TIME_RE.test(t)) throw new Error("เวลาไม่ถูกต้อง");
    const store = getStore();
    const all = await store.all("rentals");
    const row = all.find((r) => r.id === id);
    if (!row) throw new Error("ไม่พบรายการเช่านี้ (อาจถูกลบไปแล้ว)");
    const booking = all.filter((r) => r.bikeId === row.bikeId && bookingOf(r) === bookingOf(row));
    const removed = t && removeFuture ? booking.filter((r) => r.date > row.date) : [];
    if (removed.length) await store.remove("rentals", removed.map((r) => r.id));
    // ส่วนลด/ค่าปรับ/หมายเหตุ บันทึกที่แถวของวันที่กดคืน แล้วคำนวณยอดใหม่
    let rowPatch: Partial<Rental> = {};
    if (extras) {
      const discount = num(extras.discount);
      const fine = num(extras.fine);
      if (discount < 0 || fine < 0) throw new Error("ส่วนลด / ค่าปรับ ต้องไม่ติดลบ");
      const note = str(extras.note);
      rowPatch = { discount, fine, note, total: rentalTotal({ ...row, discount, fine }) };
    }
    await store.updateMany(
      "rentals",
      booking
        .filter((r) => !removed.includes(r) && (r.returnTime !== t || (r.id === row.id && extras)))
        .map((r) => ({ id: r.id, patch: r.id === row.id ? { returnTime: t, ...rowPatch } : { returnTime: t } })),
    );
    return { time: t, removed, before: extras ? row : null };
  });
}

/** เลิกทำการยกเลิกเช่า: ใส่รายการเดิมกลับ (ค่าเดิมทุกช่อง รวมเวลา ลูกค้า ส่วนลด) */
export async function restoreRentals(rows: Rental[]) {
  return guard(async () => {
    const store = getStore();
    const current = await store.all("rentals");
    // กันใส่ซ้ำ: เทียบทั้งรถ วัน เวลา และเวลาที่สร้าง (วันเดียวเช่าได้หลายรอบ)
    const sig = (r: Rental) => `${r.bikeId}|${r.date}|${r.time}|${r.createdAt}`;
    const taken = new Set(current.map(sig));
    const back = rows
      .filter((r) => isISODate(r.date) && !taken.has(sig(r)))
      .map((r) => ({ ...r, id: newId(), total: rentalTotal(r) }));
    await store.insert("rentals", back);
  });
}

export async function saveRental(input: Partial<Rental>) {
  return guard(async () => {
    if (!isISODate(input.date)) throw new Error("กรุณาเลือกวันที่");
    const store = getStore();
    const bike = (await store.all("bikes")).find((b) => b.id === input.bikeId);
    if (!bike) throw new Error("กรุณาเลือกรถ");
    const r: Rental = {
      id: input.id || newId(),
      date: input.date,
      time: str(input.time),
      dueDate: isISODate(input.dueDate) ? input.dueDate : "",
      dueTime: str(input.dueTime),
      returnTime: str(input.returnTime),
      bookingId: str(input.bookingId),
      bikeId: bike.id,
      plate: bike.plate,
      days: num(input.days ?? 1),
      price: num(input.price),
      discount: num(input.discount),
      fine: num(input.fine),
      total: 0,
      customer: str(input.customer),
      note: str(input.note),
      createdAt: input.createdAt || now(),
    };
    r.total = rentalTotal(r);
    if (input.id) await store.update("rentals", input.id, r);
    else await store.insert("rentals", [r]);
  });
}

export async function deleteRental(id: string) {
  return guard(() => getStore().remove("rentals", [id]));
}

/** ใช้กับปุ่ม "เลิกทำ" หลังบันทึกเช่าหลายวัน */
export async function deleteRentals(ids: string[]) {
  return guard(() => getStore().remove("rentals", ids));
}

// ---------------------------------------------------------------- ซักผ้า

export async function saveLaundry(input: Partial<Laundry>) {
  return guard(async () => {
    if (!isISODate(input.date)) throw new Error("กรุณาเลือกวันที่");
    const room = str(input.room);
    if (!room) throw new Error("กรุณาเลือกห้อง");
    const kg = num(input.kg);
    if (kg <= 0) throw new Error("กรุณาระบุน้ำหนัก");
    const row: Laundry = {
      id: input.id || newId(),
      date: input.date,
      time: str(input.time) || nowTime(),
      room,
      kg,
      price: num(input.price),
      paid: !!input.paid,
      note: str(input.note),
      createdAt: input.createdAt || now(),
    };
    const store = getStore();
    if (input.id) await store.update("laundry", input.id, row);
    else await store.insert("laundry", [row]);
  });
}

export async function deleteLaundry(id: string) {
  return guard(() => getStore().remove("laundry", [id]));
}

/** ลบหลายรายการ (หน้ารายการทั้งหมด) — คืนรายการที่ลบไว้ให้กดเลิกทำได้ */
export async function deleteLaundryMany(ids: string[]) {
  return guard(async () => {
    const rows = (await getStore().all("laundry")).filter((l) => ids.includes(l.id));
    await getStore().remove("laundry", ids);
    return rows;
  });
}

export async function restoreLaundry(rows: Laundry[]) {
  return guard(async () => {
    const store = getStore();
    const sig = (l: Laundry) => `${l.room}|${l.date}|${l.time}|${l.createdAt}`;
    const taken = new Set((await store.all("laundry")).map(sig));
    await store.insert(
      "laundry",
      rows.filter((l) => isISODate(l.date) && !taken.has(sig(l))).map((l) => ({ ...l, id: newId() })),
    );
  });
}

export async function setLaundryPaid(ids: string[], paid: boolean) {
  return guard(async () => {
    await getStore().updateMany("laundry", ids.map((id) => ({ id, patch: { paid } })));
  });
}

// ---------------------------------------------------------------- ตั้งค่า

export async function saveSettings(input: { laundryRate?: number; laundryPrices?: LaundryPrice[]; rooms?: string[] }) {
  return guard(async () => {
    const store = getStore();
    const existing = new Set((await store.all("settings")).map((s) => s.id));
    const entries: [string, string][] = [];
    if (input.laundryRate != null) entries.push(["laundryRate", String(num(input.laundryRate))]);
    if (input.laundryPrices) {
      const clean = input.laundryPrices
        .map((p) => ({ kg: num(p.kg), price: num(p.price) }))
        .filter((p) => p.kg > 0)
        .sort((a, b) => a.kg - b.kg);
      entries.push(["laundryPrices", JSON.stringify(clean)]);
    }
    if (input.rooms) entries.push(["rooms", input.rooms.map(str).filter(Boolean).join(",")]);
    await store.updateMany(
      "settings",
      entries.filter(([id]) => existing.has(id)).map(([id, value]) => ({ id, patch: { value } })),
    );
    await store.insert(
      "settings",
      entries.filter(([id]) => !existing.has(id)).map(([id, value]) => ({ id, value })),
    );
  });
}

/** นำเข้าข้อมูลจาก data/seed.json (สร้างจากไฟล์ Excel ด้วย scripts/extract_seed.py) */
export async function importSeed() {
  return guard(async () => {
    let seed: { bikes: Omit<Bike, "id" | "note" | "createdAt">[]; rentals: Omit<Rental, "id" | "bikeId" | "dueDate" | "dueTime" | "returnTime" | "bookingId" | "total" | "createdAt">[] };
    try {
      seed = JSON.parse(await fs.readFile(path.join(process.cwd(), "data", "seed.json"), "utf8"));
    } catch {
      throw new Error("ไม่พบไฟล์ data/seed.json");
    }
    const store = getStore();
    const bikes = await store.all("bikes");
    const byPlate = new Map(bikes.map((b) => [b.plate, b]));
    const newBikes: Bike[] = [];
    for (const b of seed.bikes) {
      if (byPlate.has(b.plate)) continue;
      const row: Bike = { ...b, id: newId(), note: "", createdAt: now() };
      byPlate.set(b.plate, row);
      newBikes.push(row);
    }
    await store.insert("bikes", newBikes);

    const rentals = await store.all("rentals");
    const seen = new Set(rentals.map((r) => `${r.plate}|${r.date}`));
    const newRentals: Rental[] = [];
    for (const r of seed.rentals) {
      const bike = byPlate.get(r.plate);
      if (!bike || (r.days > 0 && seen.has(`${r.plate}|${r.date}`))) continue;
      const row: Rental = {
        ...r,
        id: newId(),
        bikeId: bike.id,
        dueDate: "",
        dueTime: "",
        returnTime: "",
        bookingId: "",
        total: 0,
        createdAt: now(),
      };
      row.total = rentalTotal(row);
      newRentals.push(row);
    }
    await store.insert("rentals", newRentals);

    const settings = await store.all("settings");
    if (!settings.length) {
      const s = await getSettings();
      await store.insert("settings", [
        { id: "laundryRate", value: String(s.laundryRate) },
        { id: "laundryPrices", value: JSON.stringify(s.laundryPrices) },
        { id: "rooms", value: s.rooms.join(",") },
      ]);
    }
    return { bikes: newBikes.length, rentals: newRentals.length };
  });
}
