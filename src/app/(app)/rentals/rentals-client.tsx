"use client";

import { AlarmClock, CalendarClock, Check, CheckCheck, Clock, KeyRound, ListChecks, Pencil, Plus, Receipt, Rows3, Table2, Trash2, Undo2, User } from "lucide-react";
import { useMemo, useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { createBooking, deleteRental, deleteRentals, restoreRentals, saveRental, setRentalDay, setReturned } from "@/app/actions";
import { DateNav, useSetParam } from "@/components/date-nav";
import { Badge, Button, Card, Empty, Field, Input, Modal, Segmented, Select, Textarea, cn } from "@/components/ui";
import { askDialog, confirmDialog } from "@/lib/confirm";
import { TH_DAYS_SHORT, addDays, diffDays, nowTime, rangeOf, thLong, thShort, type Period } from "@/lib/dates";
import { baht } from "@/lib/format";
import { useAction } from "@/lib/hooks";
import { durationText, dueText, minutesUntilDue, overdueMinutes } from "@/lib/rental-status";
import { bookingOf, rentalTotal, type Bike, type Rental } from "@/lib/schema";

export type RentalView = "day" | "week" | "list";

const escapeHtml = (t: string) => t.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

type Change =
  | { type: "toggle"; bike: Bike; date: string; rented: boolean }
  | { type: "add"; rows: Rental[] }
  /** คืนรถทั้งการเช่า (ทุกวันของ booking) — removeAfter: ลบวันที่หลังจากนี้ (คืนก่อนกำหนด) */
  | { type: "return"; key: string; bikeId: string; time: string; removeAfter: string | null };

const sameBooking = (r: Rental, key: string, bikeId: string) => r.bikeId === bikeId && bookingOf(r) === key;

export function RentalsClient({
  bikes,
  allBikes,
  rentals,
  date,
  today,
  view,
}: {
  bikes: Bike[];
  allBikes: Bike[];
  rentals: Rental[];
  date: string;
  today: string;
  view: RentalView;
}) {
  const setParam = useSetParam();
  const [, start] = useTransition();
  const [editing, setEditing] = useState<Partial<Rental> | null>(null);
  const [renting, setRenting] = useState<Bike | null>(null);

  const [items, applyChange] = useOptimistic(rentals, (state, t: Change) =>
    t.type === "add"
      ? [...state, ...t.rows]
      : t.type === "return"
        ? state
            .filter((r) => !(t.removeAfter && sameBooking(r, t.key, t.bikeId) && r.date > t.removeAfter))
            .map((r) => (sameBooking(r, t.key, t.bikeId) ? { ...r, returnTime: t.time } : r))
        : t.rented
      ? [
          ...state,
          {
            id: `tmp-${t.bike.id}-${t.date}`,
            date: t.date,
            time: nowTime(),
            dueDate: addDays(t.date, 1),
            dueTime: nowTime(),
            returnTime: "",
            bookingId: "",
            bikeId: t.bike.id,
            plate: t.bike.plate,
            days: 1,
            price: t.bike.dailyRate,
            discount: 0,
            fine: 0,
            total: t.bike.dailyRate,
            customer: "",
            note: "",
            createdAt: "",
          },
        ]
      : state.filter((r) => !(r.bikeId === t.bike.id && r.date === t.date)),
  );

  const apply = (bike: Bike, d: string, rented: boolean, undoable = true) =>
    start(async () => {
      applyChange({ type: "toggle", bike, date: d, rented });
      const res = await setRentalDay({ bikeId: bike.id, date: d, rented, time: d === today ? nowTime() : "" });
      if (!res.ok) return void toast.error(res.error);
      const changed = res.data ?? [];
      if (!undoable || !changed.length) return;
      if (rented) {
        toast.success(`บันทึกเช่า ${bike.plate} · ${thShort(d)}`, {
          action: { label: "เลิกทำ", onClick: () => apply(bike, d, false, false) },
        });
      } else {
        // เก็บรายการที่ถูกลบไว้ กด "เลิกทำ" แล้วได้ข้อมูลเดิมกลับมาครบ (เวลา ลูกค้า ส่วนลด)
        toast(`ยกเลิกการเช่า ${bike.plate} · ${thShort(d)} แล้ว`, {
          duration: 10_000,
          action: {
            label: "เลิกทำ",
            onClick: () =>
              start(async () => {
                const r = await restoreRentals(changed);
                if (r.ok) toast.success(`คืนข้อมูลเช่า ${bike.plate} แล้ว`);
                else toast.error(r.error);
              }),
          },
        });
      }
    });

  const doReturn = (r: Rental, returned: boolean, removeFuture: boolean, undo?: { removed: Rental[]; prevTime: string }) =>
    start(async () => {
      const key = bookingOf(r);
      const time = returned ? (undo ? undo.prevTime : nowTime()) : "";
      applyChange({ type: "return", key, bikeId: r.bikeId, time, removeAfter: removeFuture ? r.date : null });
      const res = await setReturned(r.id, returned ? time : null, removeFuture);
      if (!res.ok) return void toast.error(res.error);
      if (undo) {
        if (undo.removed.length) await restoreRentals(undo.removed);
        return void toast.success("เลิกทำแล้ว");
      }
      const removed = res.data?.removed ?? [];
      toast.success(
        returned
          ? `คืนรถ ${r.plate} แล้ว · ${time} น.${removed.length ? ` (ลบ ${removed.length} วันที่เหลือ)` : ""}`
          : `ยกเลิกการคืนรถ ${r.plate} แล้ว`,
        {
          duration: 10_000,
          action: {
            label: "เลิกทำ",
            onClick: () => doReturn(r, !returned, false, { removed, prevTime: r.returnTime }),
          },
        },
      );
    });

  /** ลูกค้านำรถมาคืน — ถ้ายังมีวันที่จองไว้หลังจากนี้ ถามก่อนว่าจะลบวันที่เหลือไหม */
  const markReturned = async (r: Rental, returned: boolean) => {
    const future = returned ? items.filter((x) => sameBooking(x, bookingOf(r), r.bikeId) && x.date > r.date) : [];
    let removeFuture = false;
    if (future.length) {
      const ans = await askDialog({
        title: `คืนรถ ${escapeHtml(r.plate)} ก่อนกำหนด`,
        html: `ยังมีบันทึกเช่าวันที่ ${future.map((f) => thShort(f.date)).join(", ")} (${baht(
          future.reduce((x, f) => x + f.total, 0),
        )})<br><small>ลบวันที่เหลือ = ไม่คิดเงินวันที่ยังไม่ได้ใช้</small>`,
        confirmText: "คืนรถ + ลบวันที่เหลือ",
        denyText: "คืนรถ (คิดเงินเต็ม)",
      });
      if (ans === "cancel") return;
      removeFuture = ans === "confirm";
    }
    doReturn(r, returned, removeFuture);
  };

  /** เช่าใหม่พร้อมกำหนดคืน (สร้างบันทึกทุกวันจนถึงวันคืน) — มีปุ่มเลิกทำ */
  const book = (bike: Bike, input: RentInput) =>
    new Promise<boolean>((resolve) =>
      start(async () => {
        const res = await createBooking({ bikeId: bike.id, ...input });
        if (!res.ok) {
          toast.error(res.error);
          return resolve(false);
        }
        const rows = res.data ?? [];
        applyChange({ type: "add", rows });
        resolve(true);
        toast.success(`บันทึกเช่า ${bike.plate} · คืน ${dueText(input.dueDate, input.dueTime, today)}`, {
          duration: 10_000,
          action: {
            label: "เลิกทำ",
            onClick: () =>
              start(async () => {
                const r = await deleteRentals(rows.map((x) => x.id));
                if (r.ok) toast.success("ยกเลิกการเช่าแล้ว");
                else toast.error(r.error);
              }),
          },
        });
      }),
    );

  /** การยกเลิกเช่าต้องยืนยันก่อน กันเผลอกด */
  const toggle = async (bike: Bike, d: string, rented: boolean) => {
    if (!rented) {
      const all = items.filter((r) => r.bikeId === bike.id && r.date === d);
      const active = all.filter((r) => !r.returnTime);
      const recs = active.length ? active : all;
      const time = recs.find((r) => r.time)?.time;
      const ok = await confirmDialog({
        title: `ยกเลิกการเช่า ${escapeHtml(bike.plate)}?`,
        html: `${thLong(d)}${time ? ` · เวลา ${time}` : ""} · ${baht(recs.reduce((s, r) => s + r.total, 0))}<br><small>เวลา ลูกค้า ส่วนลด และค่าปรับของวันนี้จะถูกลบ</small>`,
        confirmText: "ยกเลิกการเช่า",
        cancelText: "ไม่ใช่ เก็บไว้",
        danger: true,
      });
      if (!ok) return;
    }
    apply(bike, d, rented);
  };

  const period: Period = view === "day" ? "day" : view === "week" ? "week" : "month";

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <DateNav date={date} period={period} today={today} />
        <div className="flex items-center gap-2">
          <Segmented
            value={view}
            onChange={(v) => setParam("v", v)}
            options={[
              { value: "day", label: <span className="flex items-center gap-1.5"><ListChecks className="size-4" />รายวัน</span> },
              { value: "week", label: <span className="flex items-center gap-1.5"><Table2 className="size-4" />สัปดาห์</span> },
              { value: "list", label: <span className="flex items-center gap-1.5"><Rows3 className="size-4" />รายการ</span> },
            ]}
          />
          <Button
            className="max-sm:hidden"
            onClick={() => setEditing({ date, days: 1, time: nowTime(), discount: 0, fine: 0 })}
          >
            <Plus className="size-4" /> เพิ่มรายการ
          </Button>
        </div>
      </div>

      {view === "day" && (
        <DayBoard
          bikes={bikes}
          rentals={items}
          date={date}
          today={today}
          onRent={setRenting}
          onToggle={toggle}
          onEdit={setEditing}
          onReturn={markReturned}
        />
      )}
      {view === "week" && <WeekGrid bikes={bikes} rentals={items} date={date} today={today} onToggle={toggle} />}
      {view === "list" && (
        <MonthList
          rentals={items}
          date={date}
          onEdit={setEditing}
          onAdd={() => setEditing({ date, days: 1, time: nowTime(), discount: 0, fine: 0 })}
        />
      )}

      <RentalForm rental={editing} bikes={allBikes} onClose={() => setEditing(null)} />
      <RentDialog bike={renting} date={date} today={today} onClose={() => setRenting(null)} onSubmit={book} />
    </>
  );
}

// ---------------------------------------------------------------- รายวัน

function DayBoard({
  bikes,
  rentals,
  date,
  today,
  onRent,
  onToggle,
  onEdit,
  onReturn,
}: {
  bikes: Bike[];
  rentals: Rental[];
  date: string;
  today: string;
  onRent: (b: Bike) => void;
  onToggle: (b: Bike, d: string, rented: boolean) => void;
  onEdit: (r: Rental) => void;
  onReturn: (r: Rental, returned: boolean) => void;
}) {
  const todays = rentals.filter((r) => r.date === date);
  // วันเดียวเช่าได้หลายรอบ (คืนแล้วเช่าต่อคนใหม่): การ์ดแสดงรอบที่ยังไม่คืน ไม่งั้นแสดงรอบล่าสุด
  const byBike = new Map<string, Rental>();
  const rounds = new Map<string, number>();
  for (const r of [...todays].sort((a, b) => (a.time || "").localeCompare(b.time || ""))) {
    rounds.set(r.bikeId, (rounds.get(r.bikeId) ?? 0) + (r.days > 0 ? 1 : 0));
    const cur = byBike.get(r.bikeId);
    if (!cur || cur.returnTime || !r.returnTime) byBike.set(r.bikeId, r);
  }
  const rented = bikes.filter((b) => byBike.has(b.id));
  const returnedCount = rented.filter((b) => byBike.get(b.id)?.returnTime).length;
  const revenue = todays.reduce((s, r) => s + r.total, 0);
  const now = nowTime();
  /** วันที่เท่าไรของการเช่าครั้งนี้ เช่น 2/3 */
  const dayOf = (r: Rental) => {
    const rows = rentals.filter((x) => sameBooking(x, bookingOf(r), r.bikeId)).map((x) => x.date).sort();
    return rows.length > 1 ? `วันที่ ${rows.indexOf(r.date) + 1}/${rows.length}` : "";
  };

  return (
    <>
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniStat label="กำลังเช่าอยู่" value={`${rented.length - returnedCount} คัน`} />
        <MiniStat label="คืนแล้ว" value={`${returnedCount} คัน`} />
        <MiniStat label="ว่าง" value={`${bikes.length - rented.length + returnedCount} คัน`} />
        <MiniStat label="รายได้วันนี้" value={baht(revenue)} accent />
      </div>
      {bikes.length === 0 ? (
        <Card>
          <Empty icon={<ListChecks />} title="ยังไม่มีรถสถานะ 'เช่า'" hint="ไปที่หน้าทะเบียนรถเพื่อเพิ่มรถก่อน" />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {bikes.map((b) => {
            const r = byBike.get(b.id);
            const on = !!r;
            const back = !!r?.returnTime;
            const saved = on && !r.id.startsWith("tmp-");
            const late = on && date === today ? overdueMinutes(r, today, now) : 0;
            const left = on && !back && date === today ? minutesUntilDue(r, today, now) : null;
            const soon = left != null && left > 0 && left <= 60;
            return (
              <div
                key={b.id}
                className={cn(
                  "relative flex flex-col gap-3 rounded-2xl border p-4 transition",
                  back
                    ? "border-good/40 bg-good-soft/50"
                    : late
                      ? "border-bad/50 bg-bad-soft/60 shadow-md shadow-bad/10"
                      : on
                        ? "border-brand bg-brand-soft/60 shadow-md shadow-brand/10"
                        : "border-line bg-surface",
                )}
              >
                <div className="flex items-center gap-4">
                <button
                  onClick={() => (on && !back ? onToggle(b, date, false) : onRent(b))}
                  aria-pressed={on}
                  aria-label={on && !back ? `ยกเลิกการเช่า ${b.plate}` : `บันทึกเช่า ${b.plate}`}
                  className={cn(
                    "grid size-14 shrink-0 cursor-pointer place-items-center rounded-2xl border-2 transition active:scale-95",
                    back
                      ? "border-good bg-good text-white"
                      : on
                        ? "border-brand bg-brand-2 text-white"
                        : "border-dashed border-line text-muted hover:border-brand hover:text-brand",
                  )}
                >
                  {back ? (
                    <CheckCheck className="size-7" strokeWidth={2.5} />
                  ) : on ? (
                    <Check className="size-7" strokeWidth={3} />
                  ) : (
                    <Plus className="size-6" />
                  )}
                </button>
                <button
                  className="min-w-0 flex-1 cursor-pointer text-left"
                  onClick={() => (on && !back ? saved && onEdit(r) : onRent(b))}
                >
                  <p className="font-bold tracking-wide">{b.plate}</p>
                  <p className="truncate text-sm text-muted">
                    {b.brand} {b.model}
                  </p>
                  {on ? (
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-brand-ink">
                      {r.time && (
                        <span className="flex items-center gap-1">
                          <Clock className="size-3" />
                          {r.time}
                        </span>
                      )}
                      {r.customer && (
                        <span className="flex items-center gap-1">
                          <User className="size-3" />
                          {r.customer}
                        </span>
                      )}
                      <span className="tabular font-semibold">{baht(r.total)}</span>
                      {dayOf(r) && <span>{dayOf(r)}</span>}
                      {(rounds.get(b.id) ?? 0) > 1 && <span>รอบที่ {rounds.get(b.id)} วันนี้</span>}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-muted">ว่าง · {baht(b.dailyRate)}/วัน</p>
                  )}
                </button>
                {saved && (
                  <Button variant="ghost" size="icon" onClick={() => onEdit(r)} aria-label="แก้ไขรายละเอียด">
                    <Pencil className="size-4" />
                  </Button>
                )}
                </div>
                {on && r.dueDate && !back && (
                  <div
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm",
                      late ? "bg-bad text-white" : soon ? "bg-warn-soft text-warn" : "bg-surface/70 text-ink-2",
                    )}
                  >
                    <span className="flex items-center gap-1.5 font-medium">
                      {late ? <AlarmClock className="size-4" /> : <CalendarClock className="size-4" />}
                      กำหนดคืน {dueText(r.dueDate, r.dueTime, today)}
                    </span>
                    {late > 0 && <span className="text-xs font-semibold">เลยมา {durationText(late)}</span>}
                    {soon && <span className="text-xs font-semibold">อีก {durationText(left)}</span>}
                  </div>
                )}
                {saved &&
                  (back ? (
                    <div className="flex items-center justify-between gap-2 rounded-xl bg-surface/70 px-3 py-2 text-sm">
                      <span className="flex items-center gap-1.5 font-medium text-good">
                        <CheckCheck className="size-4" />
                        คืนแล้ว {r.returnTime} น.
                      </span>
                      <span className="flex items-center gap-3">
                        <button
                          onClick={() => onReturn(r, false)}
                          className="flex cursor-pointer items-center gap-1 text-xs text-muted hover:text-ink"
                        >
                          <Undo2 className="size-3.5" /> ยกเลิกการคืน
                        </button>
                        <Button size="sm" onClick={() => onRent(b)}>
                          <Plus className="size-4" /> เช่าต่อคนใหม่
                        </Button>
                      </span>
                    </div>
                  ) : (
                    <Button
                      variant="secondary"
                      className="w-full border-good/40 text-good hover:bg-good-soft"
                      onClick={() => onReturn(r, true)}
                    >
                      <KeyRound className="size-4" /> ลูกค้าคืนรถแล้ว
                    </Button>
                  ))}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function MiniStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <Card className="px-4 py-3">
      <p className="text-xs text-muted">{label}</p>
      <p className={cn("tabular text-xl font-bold", accent && "text-brand")}>{value}</p>
    </Card>
  );
}

// ---------------------------------------------------------------- ตารางสัปดาห์ (แบบเดียวกับ Excel)

function WeekGrid({
  bikes,
  rentals,
  date,
  today,
  onToggle,
}: {
  bikes: Bike[];
  rentals: Rental[];
  date: string;
  today: string;
  onToggle: (b: Bike, d: string, rented: boolean) => void;
}) {
  const { days } = rangeOf("week", date);
  const map = new Map<string, Rental[]>();
  for (const r of rentals) {
    if (r.date < days[0] || r.date > days[6]) continue;
    const k = `${r.bikeId}|${r.date}`;
    map.set(k, [...(map.get(k) ?? []), r]);
  }
  const rowTotal = (b: Bike) => days.flatMap((d) => map.get(`${b.id}|${d}`) ?? []);
  const grand = bikes.reduce((s, b) => s + rowTotal(b).reduce((x, r) => x + r.total, 0), 0);

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-line bg-surface-2/50 text-xs text-muted">
              <th className="sticky left-0 z-10 bg-surface px-4 py-3 text-left font-medium">รถ</th>
              {days.map((d, i) => (
                <th key={d} className={cn("px-1 py-2 font-medium", d === today && "text-brand")}>
                  <div>{TH_DAYS_SHORT[i]}</div>
                  <div className={cn("text-base font-semibold text-ink", d === today && "text-brand")}>{Number(d.slice(8))}</div>
                </th>
              ))}
              <th className="px-3 py-3 text-right font-medium">วัน</th>
              <th className="px-4 py-3 text-right font-medium">ยอดรวม</th>
            </tr>
          </thead>
          <tbody>
            {bikes.map((b) => {
              const rows = rowTotal(b);
              const dayCount = rows.reduce((s, r) => s + r.days, 0);
              const total = rows.reduce((s, r) => s + r.total, 0);
              return (
                <tr key={b.id} className="border-b border-line last:border-0">
                  <td className="sticky left-0 z-10 bg-surface px-4 py-2">
                    <p className="font-semibold whitespace-nowrap">{b.plate}</p>
                    <p className="text-xs whitespace-nowrap text-muted">
                      {b.model} · {baht(b.dailyRate)}
                    </p>
                  </td>
                  {days.map((d) => {
                    const rs = map.get(`${b.id}|${d}`);
                    const on = !!rs?.some((r) => r.days > 0);
                    return (
                      <td key={d} className="p-1 text-center">
                        <button
                          onClick={() => onToggle(b, d, !on)}
                          aria-pressed={on}
                          aria-label={`${b.plate} ${thShort(d)}`}
                          className={cn(
                            "mx-auto flex h-12 w-full max-w-20 cursor-pointer flex-col items-center justify-center rounded-xl text-xs transition active:scale-95",
                            on
                              ? "bg-brand-2 font-semibold text-white shadow-sm"
                              : "border border-dashed border-line text-transparent hover:border-brand hover:text-brand",
                          )}
                        >
                          {on ? (
                            <>
                              {rs?.some((r) => r.returnTime) ? (
                                <CheckCheck className="size-4" strokeWidth={2.5} />
                              ) : (
                                <Check className="size-4" strokeWidth={3} />
                              )}
                              {rs?.[0]?.time && <span className="text-[10px] font-normal opacity-90">{rs[0].time}</span>}
                            </>
                          ) : (
                            <Plus className="size-4" />
                          )}
                        </button>
                      </td>
                    );
                  })}
                  <td className="tabular px-3 text-right text-ink-2">{dayCount || "-"}</td>
                  <td className="tabular px-4 text-right font-semibold">{total ? baht(total) : "-"}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-line bg-surface-2/50">
              <td className="sticky left-0 bg-surface px-4 py-3 font-semibold">รวม</td>
              {days.map((d) => {
                const n = bikes.filter((b) => map.get(`${b.id}|${d}`)?.some((r) => r.days > 0)).length;
                return (
                  <td key={d} className="tabular text-center text-xs text-muted">
                    {n ? `${n} คัน` : ""}
                  </td>
                );
              })}
              <td />
              <td className="tabular px-4 py-3 text-right text-base font-bold text-brand">{baht(grand)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------- รายการทั้งเดือน

function MonthList({
  rentals,
  date,
  onEdit,
  onAdd,
}: {
  rentals: Rental[];
  date: string;
  onEdit: (r: Rental) => void;
  onAdd: () => void;
}) {
  const month = date.slice(0, 7);
  const list = useMemo(
    () =>
      rentals
        .filter((r) => r.date.startsWith(month))
        .sort((a, b) => b.date.localeCompare(a.date) || a.plate.localeCompare(b.plate)),
    [rentals, month],
  );
  const total = list.reduce((s, r) => s + r.total, 0);
  const days = list.reduce((s, r) => s + r.days, 0);

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div className="flex gap-6">
          <div>
            <p className="text-xs text-muted">รายการ</p>
            <p className="tabular font-bold">{list.length}</p>
          </div>
          <div>
            <p className="text-xs text-muted">วันเช่ารวม</p>
            <p className="tabular font-bold">{days}</p>
          </div>
          <div>
            <p className="text-xs text-muted">ยอดรวมเดือนนี้</p>
            <p className="tabular font-bold text-brand">{baht(total)}</p>
          </div>
        </div>
        <Button size="sm" onClick={onAdd}>
          <Plus className="size-4" /> เพิ่มรายการ
        </Button>
      </div>
      {list.length === 0 ? (
        <Empty icon={<Receipt />} image="/illustrations/scooter.svg" title="ยังไม่มีรายการในเดือนนี้" />
      ) : (
        <div className="divide-y divide-line">
          {list.map((r) => (
            <button
              key={r.id}
              onClick={() => !r.id.startsWith("tmp-") && onEdit(r)}
              className="flex w-full cursor-pointer items-center gap-4 px-5 py-3 text-left hover:bg-surface-2/60"
            >
              <div className="w-16 shrink-0 text-center">
                <p className="text-lg leading-none font-bold">{Number(r.date.slice(8))}</p>
                <p className="text-[11px] text-muted">{thShort(r.date).split(" ").slice(1).join(" ")}</p>
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{r.plate}</p>
                <p className="truncate text-xs text-muted">
                  {[r.time && `เวลา ${r.time}`, r.customer, r.note].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <p className="tabular font-semibold">{baht(r.total)}</p>
                <div className="flex gap-1">
                  {r.returnTime && <Badge tone="good">คืน {r.returnTime}</Badge>}
                  {!r.returnTime && r.dueDate && <Badge tone="brand">กำหนดคืน {thShort(r.dueDate)} {r.dueTime}</Badge>}
                  {r.discount > 0 && <Badge tone="good">ลด {baht(r.discount)}</Badge>}
                  {r.fine > 0 && <Badge tone="warn">ปรับ {baht(r.fine)}</Badge>}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------- ฟอร์ม

export function RentalForm({ rental, bikes, onClose }: { rental: Partial<Rental> | null; bikes: Bike[]; onClose: () => void }) {
  const { pending, run } = useAction();
  const [form, setForm] = useState<Partial<Rental>>({});
  const [last, setLast] = useState(rental);
  if (rental !== last) {
    setLast(rental);
    setForm(rental ?? {});
  }
  const set = (k: keyof Rental) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const n = (v: unknown) => Number(v) || 0;
  const total = rentalTotal({ days: n(form.days), price: n(form.price), discount: n(form.discount), fine: n(form.fine) });

  return (
    <Modal
      open={!!rental}
      onClose={onClose}
      title={rental?.id ? "แก้ไขรายการเช่า" : "เพิ่มรายการเช่า"}
      footer={
        <>
          {rental?.id && (
            <Button
              variant="danger"
              className="mr-auto"
              disabled={pending}
              onClick={async () => {
                const ok = await confirmDialog({
                  title: "ลบรายการเช่านี้?",
                  html: `${escapeHtml(rental.plate ?? "")} · ${rental.date ? thLong(rental.date) : ""}`,
                  confirmText: "ลบรายการ",
                  danger: true,
                });
                if (ok) run(() => deleteRental(rental.id!), "ลบรายการแล้ว", onClose);
              }}
            >
              <Trash2 className="size-4" /> ลบ
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button disabled={pending} onClick={() => run(() => saveRental(form), "บันทึกแล้ว", onClose)}>
            {pending ? "กำลังบันทึก…" : "บันทึก"}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <Field label="รถ" className="col-span-2">
          <Select
            value={form.bikeId ?? ""}
            onChange={(e) => {
              const b = bikes.find((x) => x.id === e.target.value);
              setForm((f) => ({ ...f, bikeId: e.target.value, price: f.id ? f.price : b?.dailyRate }));
            }}
          >
            <option value="">— เลือกรถ —</option>
            {bikes.map((b) => (
              <option key={b.id} value={b.id}>
                {b.plate} · {b.brand} {b.model}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="วันที่ยืม">
          <Input type="date" value={form.date ?? ""} onChange={set("date")} />
        </Field>
        <Field label="เวลายืม">
          <Input type="time" value={form.time ?? ""} onChange={set("time")} />
        </Field>
        <Field label="กำหนดคืน (วันที่)">
          <Input type="date" value={form.dueDate ?? ""} onChange={set("dueDate")} />
        </Field>
        <Field label="กำหนดคืน (เวลา)">
          <Input type="time" value={form.dueTime ?? ""} onChange={set("dueTime")} />
        </Field>
        <Field label="เวลาคืนจริง (ว่าง = ยังไม่คืน)" className="col-span-2">
          <Input type="time" value={form.returnTime ?? ""} onChange={set("returnTime")} />
        </Field>
        <Field label="จำนวนวัน">
          <Input type="number" inputMode="decimal" step="0.5" min="0" value={form.days ?? ""} onChange={set("days")} />
        </Field>
        <Field label="ราคา/วัน">
          <Input type="number" inputMode="decimal" value={form.price ?? ""} onChange={set("price")} />
        </Field>
        <Field label="ส่วนลด">
          <Input type="number" inputMode="decimal" value={form.discount ?? ""} onChange={set("discount")} />
        </Field>
        <Field label="ค่าปรับ">
          <Input type="number" inputMode="decimal" value={form.fine ?? ""} onChange={set("fine")} />
        </Field>
        <Field label="ลูกค้า" className="col-span-2">
          <Input value={form.customer ?? ""} onChange={set("customer")} placeholder="ชื่อ / เบอร์โทร (ไม่บังคับ)" />
        </Field>
        <Field label="หมายเหตุ" className="col-span-2">
          <Textarea value={form.note ?? ""} onChange={set("note")} />
        </Field>
        <div className="col-span-2 flex items-center justify-between rounded-xl bg-brand-soft px-4 py-3">
          <span className="text-sm text-brand-ink">ยอดรวม</span>
          <span className="tabular text-xl font-bold text-brand-ink">{baht(total)}</span>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- เช่าใหม่ + กำหนดคืน

type RentInput = { date: string; time: string; dueDate: string; dueTime: string; customer: string };

function RentDialog({
  bike,
  date,
  today,
  onClose,
  onSubmit,
}: {
  bike: Bike | null;
  date: string;
  today: string;
  onClose: () => void;
  onSubmit: (bike: Bike, input: RentInput) => Promise<boolean>;
}) {
  const [form, setForm] = useState<RentInput>({ date: "", time: "", dueDate: "", dueTime: "", customer: "" });
  const [preset, setPreset] = useState("24h");
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<Bike | null>(null);
  if (bike !== last) {
    setLast(bike);
    if (bike) {
      const time = date === today ? nowTime() : "09:00";
      setForm({ date, time, dueDate: addDays(date, 1), dueTime: time, customer: "" });
      setPreset("24h");
    }
  }

  const offsets: Record<string, number> = { "24h": 1, "2d": 2, "3d": 3, "7d": 7 };
  const dueFor = (key: string, start: string, time: string) =>
    key === "evening" ? { dueDate: start, dueTime: "18:00" } : { dueDate: addDays(start, offsets[key] ?? 1), dueTime: time };
  const presets = [
    { key: "evening", label: "เย็นนี้ 18:00" },
    { key: "24h", label: "24 ชม." },
    { key: "2d", label: "2 วัน" },
    { key: "3d", label: "3 วัน" },
    { key: "7d", label: "1 สัปดาห์" },
  ];
  const days = form.dueDate && form.date ? Math.max(1, diffDays(form.date, form.dueDate)) : 1;
  const valid = !!form.date && !!form.time && !!form.dueTime && !!form.dueDate && form.dueDate >= form.date;

  const submit = async () => {
    if (!bike || !valid) return;
    setBusy(true);
    const ok = await onSubmit(bike, form);
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <Modal
      open={!!bike}
      onClose={onClose}
      title={bike ? `เช่า ${bike.plate}` : ""}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button disabled={!valid || busy} onClick={submit}>
            <Check className="size-4" /> {busy ? "กำลังบันทึก…" : "บันทึกเช่า"}
          </Button>
        </>
      }
    >
      {bike && (
        <div className="space-y-5">
          <p className="-mt-1 text-sm text-muted">
            {bike.brand} {bike.model} · {baht(bike.dailyRate)}/วัน
          </p>

          <div className="grid grid-cols-2 gap-3">
            <Field label="วันที่ยืม">
              <Input
                type="date"
                value={form.date}
                onChange={(e) => {
                  const start = e.target.value;
                  if (!start) return;
                  // ปุ่มลัดกำหนดคืนนับจากวันที่ยืมใหม่
                  setForm((f) => ({ ...f, date: start, ...(preset === "custom" ? {} : dueFor(preset, start, f.time)) }));
                }}
              />
            </Field>
            <Field label="เวลายืม">
              <Input
                type="time"
                value={form.time}
                onChange={(e) => {
                  const time = e.target.value;
                  // กำหนดคืนแบบนับวัน ให้เวลาคืนตามเวลารับรถ
                  setForm((f) => ({ ...f, time, dueTime: preset === "evening" || preset === "custom" ? f.dueTime : time }));
                }}
              />
            </Field>
          </div>
          {form.date !== today && (
            <p className="-mt-3 text-xs text-warn">ลงย้อนหลัง/ล่วงหน้า: {thLong(form.date)}</p>
          )}

          <div>
            <p className="mb-2 text-xs font-medium text-ink-2">กำหนดคืน</p>
            <div className="flex flex-wrap gap-2">
              {presets.map((p) => (
                <button
                  key={p.key}
                  onClick={() => {
                    setPreset(p.key);
                    setForm((f) => ({ ...f, ...dueFor(p.key, f.date, f.time) }));
                  }}
                  className={cn(
                    "cursor-pointer rounded-xl border px-3 py-2 text-sm font-medium transition",
                    preset === p.key ? "border-brand bg-brand-2 text-white" : "border-line text-ink-2 hover:border-brand/50",
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Field label="วันที่คืน">
                <Input
                  type="date"
                  min={form.date}
                  value={form.dueDate}
                  onChange={(e) => {
                    setPreset("custom");
                    setForm((f) => ({ ...f, dueDate: e.target.value }));
                  }}
                />
              </Field>
              <Field label="เวลาคืน">
                <Input
                  type="time"
                  value={form.dueTime}
                  onChange={(e) => {
                    setPreset("custom");
                    setForm((f) => ({ ...f, dueTime: e.target.value }));
                  }}
                />
              </Field>
            </div>
          </div>

          <Field label="ลูกค้า (ไม่บังคับ)">
            <Input
              value={form.customer}
              onChange={(e) => setForm((f) => ({ ...f, customer: e.target.value }))}
              placeholder="ชื่อ / เบอร์โทร / ห้อง"
            />
          </Field>

          <div className="rounded-xl bg-brand-soft px-4 py-3 text-brand-ink">
            <div className="flex items-center justify-between">
              <span className="text-sm">
                เช่า {days} วัน · คืน {dueText(form.dueDate, form.dueTime, today)}
              </span>
              <span className="tabular text-xl font-bold">{baht(days * bike.dailyRate)}</span>
            </div>
            {days > 1 && <p className="mt-1 text-xs opacity-80">ระบบจะลงบันทึกให้ทุกวัน ({days} วัน) คิดเงินรายวัน</p>}
          </div>
        </div>
      )}
    </Modal>
  );
}
