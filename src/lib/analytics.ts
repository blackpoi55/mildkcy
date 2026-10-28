import { addDays, addMonths, dayOfWeek, diffDays, rangeOf, shift, startOfMonth, thShort, TH_DAYS_SHORT, TH_MONTHS_SHORT, type Period } from "./dates";
import { expiryState } from "./expiry";
import { RENTABLE_STATUS, type Bike, type Laundry, type Rental } from "./schema";

export type DayPoint = { date: string; label: string; rent: number; laundry: number; bikes: number };
export type MonthPoint = { month: string; label: string; rent: number; laundry: number };

function sumBy<T>(list: T[], f: (x: T) => number) {
  return list.reduce((s, x) => s + f(x), 0);
}

function totals(rentals: Rental[], laundry: Laundry[], start: string, end: string, rentableBikes: number) {
  const r = rentals.filter((x) => x.date >= start && x.date <= end);
  const l = laundry.filter((x) => x.date >= start && x.date <= end);
  const days = diffDays(start, end) + 1;
  const bikeDays = sumBy(r, (x) => x.days);
  return {
    rent: sumBy(r, (x) => x.total),
    laundry: sumBy(l, (x) => x.price),
    bikeDays,
    occupancy: rentableBikes ? (bikeDays / (rentableBikes * days)) * 100 : 0,
    laundryKg: sumBy(l, (x) => x.kg),
    laundryCount: l.length,
    laundryUnpaid: sumBy(
      l.filter((x) => !x.paid),
      (x) => x.price,
    ),
    rentals: r,
    laundryItems: l,
  };
}

export function buildDashboard(
  period: Period,
  date: string,
  today: string,
  bikes: Bike[],
  rentals: Rental[],
  laundry: Laundry[],
) {
  const rentable = bikes.filter((b) => b.status === RENTABLE_STATUS).length;
  const { start, end, days } = rangeOf(period, date);
  const prev = rangeOf(period, shift(period, date, -1));
  const cur = totals(rentals, laundry, start, end, rentable);
  const before = totals(rentals, laundry, prev.start, prev.end, rentable);

  // กราฟรายวัน: รายวัน → ย้อนหลัง 14 วัน, สัปดาห์/เดือน → ทุกวันในช่วง
  const chartDays = period === "day" ? Array.from({ length: 14 }, (_, i) => addDays(date, i - 13)) : days;
  const byDate = new Map<string, DayPoint>(
    chartDays.map((d) => [
      d,
      {
        date: d,
        label: period === "month" ? String(Number(d.slice(8))) : `${TH_DAYS_SHORT[dayOfWeek(d)]} ${Number(d.slice(8))}`,
        rent: 0,
        laundry: 0,
        bikes: 0,
      },
    ]),
  );
  for (const r of rentals) {
    const p = byDate.get(r.date);
    if (p) {
      p.rent += r.total;
      p.bikes += r.days;
    }
  }
  for (const l of laundry) {
    const p = byDate.get(l.date);
    if (p) p.laundry += l.price;
  }

  // แนวโน้ม 12 เดือน
  const firstMonth = addMonths(startOfMonth(date), -11);
  const months: MonthPoint[] = Array.from({ length: 12 }, (_, i) => {
    const m = addMonths(firstMonth, i).slice(0, 7);
    const [y, mm] = m.split("-").map(Number);
    return { month: m, label: `${TH_MONTHS_SHORT[mm - 1]} ${String(y + 543).slice(2)}`, rent: 0, laundry: 0 };
  });
  const byMonth = new Map(months.map((m) => [m.month, m]));
  for (const r of rentals) {
    const m = byMonth.get(r.date.slice(0, 7));
    if (m) m.rent += r.total;
  }
  for (const l of laundry) {
    const m = byMonth.get(l.date.slice(0, 7));
    if (m) m.laundry += l.price;
  }

  // รถทำเงินสูงสุดในช่วง
  const bikeById = new Map(bikes.map((b) => [b.id, b]));
  const topMap = new Map<string, { id: string; plate: string; model: string; revenue: number; days: number }>();
  for (const r of cur.rentals) {
    const b = bikeById.get(r.bikeId);
    const t = topMap.get(r.bikeId) ?? { id: r.bikeId, plate: r.plate, model: b ? `${b.brand} ${b.model}` : "", revenue: 0, days: 0 };
    t.revenue += r.total;
    t.days += r.days;
    topMap.set(r.bikeId, t);
  }
  const topBikes = [...topMap.values()].sort((a, b) => b.revenue - a.revenue);

  // ซักผ้ารายห้อง
  const roomMap = new Map<string, { room: string; revenue: number; kg: number; count: number }>();
  for (const l of cur.laundryItems) {
    const t = roomMap.get(l.room) ?? { room: l.room, revenue: 0, kg: 0, count: 0 };
    t.revenue += l.price;
    t.kg += l.kg;
    t.count += 1;
    roomMap.set(l.room, t);
  }
  const rooms = [...roomMap.values()].sort((a, b) => b.revenue - a.revenue);

  // แจ้งเตือนภาษี/บัตร
  const alerts = bikes
    .filter((b) => !["ซากรถ", "ขายแล้ว"].includes(b.status))
    .flatMap((b) => {
      const out: { bike: Bike; kind: string; date: string; tone: "bad" | "warn"; label: string; left: number }[] = [];
      const tax = expiryState(b.taxExpiry, today);
      if (tax && tax.tone !== "good") out.push({ bike: b, kind: "ภาษี", date: b.taxExpiry, tone: tax.tone, label: tax.label, left: tax.left });
      const card = expiryState(b.cardExpiry, today);
      if (card && card.tone !== "good") out.push({ bike: b, kind: "บัตร", date: b.cardExpiry, tone: card.tone, label: card.label, left: card.left });
      return out;
    })
    .sort((a, b) => a.left - b.left);

  // วันนี้: รถที่ว่าง/ถูกเช่า
  const dayRentals = rentals.filter((r) => r.date === date && r.days > 0);
  const rentedIds = new Set(dayRentals.map((r) => r.bikeId));

  return {
    period,
    date,
    range: { start, end, label: `${thShort(start)} – ${thShort(end)}` },
    rentable,
    cur: { ...cur, rentals: undefined, laundryItems: undefined, total: cur.rent + cur.laundry },
    prev: { rent: before.rent, laundry: before.laundry, total: before.rent + before.laundry, bikeDays: before.bikeDays, occupancy: before.occupancy, laundryKg: before.laundryKg },
    daily: [...byDate.values()],
    months,
    topBikes,
    rooms,
    alerts,
    day: {
      rented: dayRentals.length,
      free: bikes.filter((b) => b.status === RENTABLE_STATUS && !rentedIds.has(b.id)),
    },
  };
}

export type Dashboard = ReturnType<typeof buildDashboard>;
