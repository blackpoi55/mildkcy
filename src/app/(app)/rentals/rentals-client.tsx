"use client";

import { AlarmClock, CalendarClock, Check, CheckCheck, Clock, KeyRound, ListChecks, Pencil, Plus, Receipt, Rows3, Search, Table2, Trash2, Undo2, User, X } from "lucide-react";
import { useMemo, useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { createBooking, deleteRental, deleteRentals, restoreRentals, saveRental, setRentalDay, setReturned } from "@/app/actions";
import { DateNav, useSetParam } from "@/components/date-nav";
import { Badge, Button, Card, Empty, Field, Input, Modal, Segmented, Select, Textarea, cn } from "@/components/ui";
import { confirmDialog } from "@/lib/confirm";
import { TH_DAYS_SHORT, addDays, diffDays, nowTime, rangeOf, thLong, thShort, type Period } from "@/lib/dates";
import { baht } from "@/lib/format";
import { useAction } from "@/lib/hooks";
import {
  backOn,
  billingEnd,
  coversDay,
  durationText,
  dueText,
  lastDayOut,
  minutesUntilDue,
  overdueMinutes,
  planDay,
  resized,
  returnDateOf,
  returnedText,
  usedDays,
  type DayPlan,
} from "@/lib/rental-status";
import { bookingOf, rentalTotal, type Bike, type Rental } from "@/lib/schema";

export type RentalView = "day" | "week" | "list";
/** แท็บบนสุด: ปล่อยเช่า / รับรถคืน */
export type RentalMode = "rent" | "return";

const escapeHtml = (t: string) => t.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** ค้นหาทะเบียนแบบไม่สนช่องว่าง/ขีด: "8245", "1กญ8245", "1กญ - 8245" เจอเหมือนกัน */
const norm = (t: string) => t.toLowerCase().replace(/[\s-]/g, "");

function NoMatch({ q }: { q?: string }) {
  return (
    <Card>
      <Empty
        icon={<Search />}
        title={q ? `ไม่พบ “${q}”` : "ไม่พบรถตามที่กรอง"}
        hint="ลองพิมพ์ทะเบียนบางส่วน เช่น 8245 หรือเปลี่ยนตัวกรอง"
      />
    </Card>
  );
}

type Change =
  /** เพิ่ม/แทนที่รายการ (ตาม id) */
  | { type: "put"; row: Rental }
  | { type: "drop"; id: string }
  | { type: "add"; rows: Rental[] }
  /** คืนรถ (ข้อมูลเก่าที่เป็นแถวรายวัน: ทุกแถวของ booking) — days: จำนวนวันที่คิดเงินใหม่ */
  | {
      type: "return";
      key: string;
      bikeId: string;
      time: string;
      /** วันที่คืนจริง ("" = ยกเลิกการคืน) */
      date: string;
      days: number | null;
      rowId: string;
      extras?: Extras;
    };

type Extras = { discount: number; fine: number; note: string };

const sameBooking = (r: Rental, key: string, bikeId: string) => r.bikeId === bikeId && bookingOf(r) === key;

export function RentalsClient({
  bikes,
  allBikes,
  rentals,
  date,
  today,
  view,
  mode,
  outstanding,
  returnedToday,
}: {
  bikes: Bike[];
  allBikes: Bike[];
  rentals: Rental[];
  date: string;
  today: string;
  view: RentalView;
  mode: RentalMode;
  /** รถที่ยังไม่คืน (ทุกวัน ไม่จำกัดเดือนที่ดู) */
  outstanding: Rental[];
  returnedToday: Rental[];
}) {
  const setParam = useSetParam();
  const [, start] = useTransition();
  const [editing, setEditing] = useState<Partial<Rental> | null>(null);
  const [renting, setRenting] = useState<Bike | null>(null);
  const [returning, setReturning] = useState<Rental | null>(null);
  const [q, setQ] = useState("");
  /** ซ่อนรายการที่เพิ่งกดคืน ระหว่างรอข้อมูลใหม่จากชีต */
  const [gone, setGone] = useState<Set<string>>(new Set());
  const [show, setShow] = useState<"all" | "active" | "free" | "returned">("all");

  const [items, applyChange] = useOptimistic(rentals, (state, t: Change) => {
    switch (t.type) {
      case "add":
        return [...state, ...t.rows];
      case "put":
        return state.some((r) => r.id === t.row.id) ? state.map((r) => (r.id === t.row.id ? t.row : r)) : [...state, t.row];
      case "drop":
        return state.filter((r) => r.id !== t.id);
      case "return":
        return state.map((r) => {
          if (!sameBooking(r, t.key, t.bikeId)) return r;
          if (r.id !== t.rowId) return { ...r, returnTime: t.time, returnDate: t.date };
          const n = { ...r, ...t.extras, ...(t.days ? { days: t.days } : {}), returnTime: t.time, returnDate: t.date };
          return { ...n, total: rentalTotal(n) };
        });
    }
  });

  /** ติ๊ก/ยกเลิกวันเช่าในตาราง ตามแผนที่คำนวณไว้ (สร้างใหม่ / ต่อวัน / ลดวัน / ลบ) — มีปุ่มเลิกทำ */
  const apply = (bike: Bike, d: string, rented: boolean, plan: DayPlan) =>
    start(async () => {
      if (plan.kind === "create") {
        const time = d === today ? nowTime() : "09:00";
        applyChange({
          type: "put",
          row: {
            id: `tmp-${bike.id}-${d}`,
            date: d,
            time,
            dueDate: addDays(d, 1),
            dueTime: time,
            returnDate: "",
            returnTime: "",
            bookingId: "",
            bikeId: bike.id,
            plate: bike.plate,
            days: 1,
            price: bike.dailyRate,
            discount: 0,
            fine: 0,
            total: bike.dailyRate,
            customer: "",
            note: "",
            createdAt: "",
          },
        });
      } else if (plan.kind === "remove") applyChange({ type: "drop", id: plan.target.id });
      else if (plan.kind !== "none" && plan.kind !== "blocked") applyChange({ type: "put", row: resized(plan.target, plan.kind) });

      const res = await setRentalDay({ bikeId: bike.id, date: d, rented, time: d === today ? nowTime() : "" });
      if (!res.ok) return void toast.error(res.error);
      const c = res.data;
      if (!c || (!c.created.length && !c.removed.length && !c.before)) return;
      const label =
        plan.kind === "extend"
          ? `ต่อการเช่า ${bike.plate} เป็น ${plan.target.days + 1} วัน`
          : plan.kind === "shrink" || plan.kind === "shift"
            ? `ลดการเช่า ${bike.plate} เหลือ ${plan.target.days - 1} วัน`
            : rented
              ? `บันทึกเช่า ${bike.plate} · ${thShort(d)}`
              : `ยกเลิกการเช่า ${bike.plate} · ${thShort(d)} แล้ว`;
      toast.success(label, {
        duration: 10_000,
        action: {
          label: "เลิกทำ",
          onClick: () =>
            start(async () => {
              // ย้อนกลับครบทุกช่อง (เวลา ลูกค้า ส่วนลด จำนวนวัน)
              const r = c.created.length
                ? await deleteRentals(c.created.map((x) => x.id))
                : c.removed.length
                  ? await restoreRentals(c.removed)
                  : await saveRental(c.before!);
              if (r.ok) toast.success("เลิกทำแล้ว");
              else toast.error(r.error);
            }),
        },
      });
    });

  const runReturn = (r: Rental, time: string | null, days: number | null, extras?: Extras, date?: string) => {
    applyChange({
      type: "return",
      key: bookingOf(r),
      bikeId: r.bikeId,
      time: time ?? "",
      date: time ? date || today : "",
      days,
      rowId: r.id,
      extras,
    });
    return setReturned(r.id, time, days, extras, date);
  };

  /** บันทึกคืนรถจากหน้าต่างคืนรถ — มีปุ่มเลิกทำ (คืนค่าส่วนลด/ค่าปรับ/หมายเหตุเดิม + วันที่ถูกลบ) */
  const confirmReturn = (r: Rental, input: ReturnInput) =>
    new Promise<boolean>((resolve) =>
      start(async () => {
        const extras = { discount: input.discount, fine: input.fine, note: input.note };
        const res = await runReturn(r, input.time, input.days === r.days ? null : input.days, extras, input.date);
        if (!res.ok) {
          toast.error(res.error);
          return resolve(false);
        }
        resolve(true);
        setGone((g) => new Set(g).add(r.id));
        toast.success(
          `คืนรถ ${r.plate} แล้ว · ${input.date !== today ? `${thShort(input.date)} ` : ""}${input.time} น.${
            input.days !== r.days ? ` (คิด ${input.days} วัน)` : ""
          }`,
          {
            duration: 10_000,
            action: {
              label: "เลิกทำ",
              onClick: () =>
                start(async () => {
                  const u = await runReturn(r, null, r.days, { discount: r.discount, fine: r.fine, note: r.note });
                  setGone((g) => {
                    const n = new Set(g);
                    n.delete(r.id);
                    return n;
                  });
                  if (u.ok) toast.success("เลิกทำแล้ว");
                  else toast.error(u.error);
                }),
            },
          },
        );
      }),
    );

  const unReturn = (r: Rental) =>
    start(async () => {
      const prev = { time: r.returnTime, date: returnDateOf(r) };
      const res = await runReturn(r, null, null);
      if (!res.ok) return void toast.error(res.error);
      toast.success(`ยกเลิกการคืนรถ ${r.plate} แล้ว`, {
        duration: 10_000,
        action: {
          label: "เลิกทำ",
          onClick: () =>
            start(async () => {
              const u = await runReturn(r, prev.time, null, undefined, prev.date);
              if (u.ok) toast.success("เลิกทำแล้ว");
              else toast.error(u.error);
            }),
        },
      });
    });

  /** กดคืนรถ = เปิดหน้าต่างคืนรถ (แก้เวลา ส่วนลด ค่าปรับ หมายเหตุได้) / ยกเลิกการคืน = ทำทันที */
  const markReturned = (r: Rental, returned: boolean) => (returned ? setReturning(r) : unReturn(r));

  /** เช่าใหม่พร้อมกำหนดคืน (1 รายการ กี่วันก็ได้) — มีปุ่มเลิกทำ */
  const book = (bike: Bike, input: RentInput) =>
    new Promise<boolean>((resolve) =>
      start(async () => {
        const res = await createBooking({
          bikeId: bike.id,
          ...input,
          discount: Number(input.discount) || 0,
          fine: Number(input.fine) || 0,
        });
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

  /** ติ๊ก/ยกเลิกวันเช่า — การลด/ยกเลิกต้องยืนยันก่อน กันเผลอกด, แก้กลางการเช่าไม่ได้ → เปิดหน้าต่างแก้ไข */
  const toggle = async (bike: Bike, d: string, rented: boolean) => {
    const plan = planDay(items.filter((r) => r.bikeId === bike.id), d, rented, today);
    if (plan.kind === "none") return;
    if (plan.kind === "blocked") {
      toast(plan.reason);
      if (!plan.target.id.startsWith("tmp-")) setEditing(plan.target);
      return;
    }
    if (plan.kind === "remove" || plan.kind === "shrink" || plan.kind === "shift") {
      const t = plan.target;
      const ok = await confirmDialog(
        plan.kind === "remove"
          ? {
              title: `ยกเลิกการเช่า ${escapeHtml(bike.plate)}?`,
              html: `${thLong(t.date)}${t.time ? ` · เวลา ${t.time}` : ""} · ${baht(t.total)}${t.customer ? ` · ${escapeHtml(t.customer)}` : ""}<br><small>เวลา ลูกค้า ส่วนลด และค่าปรับของการเช่านี้จะถูกลบ</small>`,
              confirmText: "ยกเลิกการเช่า",
              cancelText: "ไม่ใช่ เก็บไว้",
              danger: true,
            }
          : {
              title: `ลดการเช่า ${escapeHtml(bike.plate)} เหลือ ${t.days - 1} วัน?`,
              html: `ไม่คิดเงินวันที่ ${thLong(d)} · ยอดใหม่ ${baht(resized(t, plan.kind).total)}`,
              confirmText: "ลดวัน",
              cancelText: "ไม่ใช่ เก็บไว้",
              danger: true,
            },
      );
      if (!ok) return;
    }
    apply(bike, d, rented, plan);
  };

  const period: Period = view === "day" ? "day" : view === "week" ? "week" : "month";

  // ---------------------------------------------------------------- ค้นหา / กรอง
  const needle = norm(q);
  const { days: weekDays } = rangeOf("week", date);
  // รายการที่รถออกไปในช่วงนี้ (เช่าหลายวันนับทุกวันที่รถไม่อยู่ร้าน)
  const rowsOn = (from: string, to: string) => items.filter((r) => r.date <= to && lastDayOut(r, today) >= from);
  const textMatch = (b: Bike, rows: Rental[]) =>
    !needle ||
    norm(`${b.plate} ${b.brand} ${b.model} ${rows.filter((r) => r.bikeId === b.id).map((r) => r.customer).join(" ")}`).includes(
      needle,
    );
  const dayRows = rowsOn(date, date);
  const activeIds = new Set(
    dayRows.filter((r) => r.days > 0 && (!r.returnTime || returnDateOf(r) > date)).map((r) => r.bikeId),
  );
  const returnedIds = new Set(dayRows.filter((r) => backOn(r, date)).map((r) => r.bikeId));
  const dayBikes = bikes.filter(
    (b) =>
      textMatch(b, dayRows) &&
      (show === "all" ||
        (show === "active" && activeIds.has(b.id)) ||
        (show === "free" && !activeIds.has(b.id)) ||
        (show === "returned" && returnedIds.has(b.id) && !activeIds.has(b.id))),
  );
  const weekRows = rowsOn(weekDays[0], weekDays[6]);
  const weekBikes = bikes.filter((b) => textMatch(b, weekRows));
  const listRentals = needle ? items.filter((r) => norm(`${r.plate} ${r.customer} ${r.note}`).includes(needle)) : items;
  const filtering = !!needle || (view === "day" && show !== "all");

  const nowHM = nowTime();
  const out = outstanding.filter(
    (r) => !gone.has(r.id) && (!needle || norm(`${r.plate} ${r.customer} ${bikeLabel(allBikes, r.bikeId)}`).includes(needle)),
  );
  const lateCount = out.filter((r) => (minutesUntilDue(r, today, nowHM) ?? 1) < 0).length;
  const backToday = returnedToday.filter(
    (r) => !needle || norm(`${r.plate} ${r.customer} ${bikeLabel(allBikes, r.bikeId)}`).includes(needle),
  );

  const searchBox = (
    <div className="relative min-w-0 flex-1 basis-60">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="ค้นหาทะเบียน ยี่ห้อ รุ่น หรือชื่อลูกค้า…"
        className="pr-9 pl-9"
        aria-label="ค้นหา"
      />
      {q && (
        <button
          onClick={() => setQ("")}
          className="absolute top-1/2 right-2 grid size-6 -translate-y-1/2 cursor-pointer place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-ink"
          aria-label="ล้างคำค้น"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );

  return (
    <>
      {/* แท็บหลัก: เช่ารถ / คืนรถ */}
      <div className="mb-5 grid grid-cols-2 gap-2 rounded-2xl bg-surface-2 p-1.5 sm:inline-grid sm:min-w-[420px]" role="tablist">
        {(
          [
            ["rent", "เช่ารถ", "ปล่อยเช่า / ดูตาราง", <Plus key="i" className="size-5" />],
            ["return", "คืนรถ", `ยังไม่คืน ${outstanding.length} คัน`, <KeyRound key="i" className="size-5" />],
          ] as const
        ).map(([key, label, sub, icon]) => (
          <button
            key={key}
            role="tab"
            aria-selected={mode === key}
            onClick={() => setParam("mode", key)}
            className={cn(
              "relative flex cursor-pointer items-center gap-3 rounded-xl px-4 py-2.5 text-left transition",
              mode === key ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink",
            )}
          >
            <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg", mode === key ? "bg-brand-soft text-brand" : "bg-surface/60")}>
              {icon}
            </span>
            <span className="min-w-0">
              <span className="block font-semibold">{label}</span>
              <span className="block truncate text-xs">{sub}</span>
            </span>
            {key === "return" && lateCount > 0 && (
              <span className="absolute top-2 right-2 rounded-full bg-bad px-1.5 text-[11px] font-bold text-white">
                เลย {lateCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {mode === "return" ? (
        <>
          <div className="mb-5 flex">{searchBox}</div>
          <ReturnTab
            outstanding={out}
            returnedToday={backToday}
            bikes={allBikes}
            today={today}
            now={nowHM}
            searching={!!needle}
            onReturn={(r) => setReturning(r)}
            onUnreturn={unReturn}
            onEdit={setEditing}
            onGoRent={() => setParam("mode", "rent")}
          />
        </>
      ) : (
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

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {searchBox}
        {view === "day" && (
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            {(
              [
                ["all", "ทั้งหมด", bikes.length],
                ["active", "กำลังเช่า", bikes.filter((b) => activeIds.has(b.id)).length],
                ["free", "ว่าง", bikes.filter((b) => !activeIds.has(b.id)).length],
                ["returned", "คืนแล้ว", bikes.filter((b) => returnedIds.has(b.id) && !activeIds.has(b.id)).length],
              ] as const
            ).map(([key, label, n]) => (
              <button
                key={key}
                onClick={() => setShow(key)}
                className={cn(
                  "flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition",
                  show === key ? "border-brand bg-brand-soft text-brand-ink" : "border-line bg-surface text-ink-2 hover:border-muted",
                )}
              >
                {label}
                <span className="text-xs text-muted">{n}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {view === "day" && (
        <DayBoard
          bikes={bikes}
          shown={dayBikes}
          filtering={filtering}
          rentals={items}
          date={date}
          today={today}
          onRent={setRenting}
          onToggle={toggle}
          onEdit={setEditing}
          onReturn={markReturned}
        />
      )}
      {view === "week" &&
        (weekBikes.length ? (
          <WeekGrid bikes={weekBikes} rentals={items} date={date} today={today} onToggle={toggle} />
        ) : (
          <NoMatch q={q} />
        ))}
      {view === "list" && (
        <MonthList
          rentals={listRentals}
          date={date}
          onEdit={setEditing}
          onAdd={() => setEditing({ date, days: 1, time: nowTime(), discount: 0, fine: 0 })}
        />
      )}

        </>
      )}

      <RentalForm rental={editing} bikes={allBikes} onClose={() => setEditing(null)} />
      <RentDialog bike={renting} date={date} today={today} onClose={() => setRenting(null)} onSubmit={book} />
      <ReturnDialog
        rental={returning}
        today={today}
        onClose={() => setReturning(null)}
        onSubmit={confirmReturn}
      />
    </>
  );
}

// ---------------------------------------------------------------- รายวัน

function DayBoard({
  bikes,
  shown,
  filtering,
  rentals,
  date,
  today,
  onRent,
  onToggle,
  onEdit,
  onReturn,
}: {
  bikes: Bike[];
  shown: Bike[];
  filtering: boolean;
  rentals: Rental[];
  date: string;
  today: string;
  onRent: (b: Bike) => void;
  onToggle: (b: Bike, d: string, rented: boolean) => void;
  onEdit: (r: Rental) => void;
  onReturn: (r: Rental, returned: boolean) => void;
}) {
  // การเช่าที่รถออกไปในวันนี้ (เช่าหลายวันแสดงทุกวัน)
  const todays = rentals.filter((r) => coversDay(r, date, today));
  // วันเดียวเช่าได้หลายรอบ (คืนแล้วเช่าต่อคนใหม่): การ์ดแสดงรอบที่ยังไม่คืน ไม่งั้นแสดงรอบล่าสุด
  const byBike = new Map<string, Rental>();
  const rounds = new Map<string, number>();
  for (const r of [...todays].sort((a, b) => (a.time || "").localeCompare(b.time || ""))) {
    rounds.set(r.bikeId, (rounds.get(r.bikeId) ?? 0) + (r.days > 0 ? 1 : 0));
    const cur = byBike.get(r.bikeId);
    if (!cur || cur.returnTime || !r.returnTime) byBike.set(r.bikeId, r);
  }
  const rented = bikes.filter((b) => byBike.has(b.id));
  const returnedCount = rented.filter((b) => {
    const r = byBike.get(b.id);
    return r && backOn(r, date);
  }).length;
  // รายได้นับที่วันเริ่มเช่า (เช่า 3 วันคิดยอดทั้งหมดในวันแรก)
  const revenue = rentals.filter((r) => r.date === date).reduce((s, r) => s + r.total, 0);
  const now = nowTime();
  /** วันที่เท่าไรของการเช่าครั้งนี้ เช่น "วันที่ 2/3" (เลยวันที่คิดเงินแล้ว = ไม่แสดง) */
  const dayOf = (r: Rental) => {
    const n = diffDays(r.date, date) + 1;
    return r.days > 1 && n <= r.days ? `วันที่ ${n}/${r.days}` : "";
  };

  return (
    <>
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniStat label="กำลังเช่าอยู่" value={`${rented.length - returnedCount} คัน`} />
        <MiniStat label="คืนแล้ว" value={`${returnedCount} คัน`} />
        <MiniStat label="ว่าง" value={`${bikes.length - rented.length + returnedCount} คัน`} />
        <MiniStat label="รายได้วันนี้" value={baht(revenue)} accent />
      </div>
      {shown.length === 0 ? (
        filtering ? (
          <NoMatch />
        ) : (
          <Card>
            <Empty icon={<ListChecks />} title="ยังไม่มีรถสถานะ 'เช่า'" hint="ไปที่หน้าทะเบียนรถเพื่อเพิ่มรถก่อน" />
          </Card>
        )
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((b) => {
            const r = byBike.get(b.id);
            const on = !!r;
            // คืนแล้ว = คืนในวันนี้ (วันก่อนหน้าของการเช่าเดียวกัน ยังแสดงว่ากำลังเช่า)
            const back = !!r && backOn(r, date);
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
                      <span className="tabular font-semibold">
                        {baht(r.total)}
                        {r.days > 1 && <span className="font-normal"> / {r.days} วัน</span>}
                      </span>
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
                {on && r.dueDate && !back && !r.returnTime && (
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
                        คืนแล้ว {returnedText(r)} น.
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
  // ช่องที่รถออกไป: การเช่าหลายวันติ๊กทุกวัน
  const map = new Map<string, Rental[]>();
  for (const r of rentals) {
    for (const d of days) {
      if (!coversDay(r, d, today)) continue;
      const k = `${r.bikeId}|${d}`;
      map.set(k, [...(map.get(k) ?? []), r]);
    }
  }
  // ยอดเงินนับที่วันเริ่มเช่า
  const started = (b: Bike) => rentals.filter((r) => r.bikeId === b.id && r.date >= days[0] && r.date <= days[6]);
  const grand = bikes.reduce((s, b) => s + started(b).reduce((x, r) => x + r.total, 0), 0);

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
              const dayCount = days.filter((d) => map.get(`${b.id}|${d}`)?.some((r) => r.days > 0)).length;
              const total = started(b).reduce((s, r) => s + r.total, 0);
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
                    const first = rs?.find((r) => !r.returnTime) ?? rs?.[0];
                    // เลยวันที่คิดเงินแล้วยังไม่คืน = เลยกำหนด
                    const over = !!first && !first.returnTime && d > billingEnd(first);
                    return (
                      <td key={d} className="p-1 text-center">
                        <button
                          onClick={() => onToggle(b, d, !on)}
                          aria-pressed={on}
                          aria-label={`${b.plate} ${thShort(d)}`}
                          className={cn(
                            "mx-auto flex h-12 w-full max-w-20 cursor-pointer flex-col items-center justify-center rounded-xl text-xs transition active:scale-95",
                            over
                              ? "bg-bad font-semibold text-white shadow-sm"
                              : on
                              ? "bg-brand-2 font-semibold text-white shadow-sm"
                              : "border border-dashed border-line text-transparent hover:border-brand hover:text-brand",
                          )}
                        >
                          {on ? (
                            <>
                              {rs?.some((r) => backOn(r, d)) ? (
                                <CheckCheck className="size-4" strokeWidth={2.5} />
                              ) : (
                                <Check className="size-4" strokeWidth={3} />
                              )}
                              <span className="text-[10px] font-normal opacity-90">
                                {over
                                  ? "เลยกำหนด"
                                  : first && first.date === d
                                    ? first.time
                                    : first && first.days > 1
                                      ? `${diffDays(first.date, d) + 1}/${first.days}`
                                      : ""}
                              </span>
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
                  {[r.time && `เวลา ${r.time}`, r.days !== 1 && `${r.days} วัน`, r.customer, r.note].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <p className="tabular font-semibold">{baht(r.total)}</p>
                <div className="flex gap-1">
                  {r.returnTime && <Badge tone="good">คืน {returnedText(r)}</Badge>}
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
        <Field label="วันที่คืนจริง">
          <Input type="date" value={form.returnDate ?? ""} onChange={set("returnDate")} />
        </Field>
        <Field label="เวลาคืนจริง (ว่าง = ยังไม่คืน)">
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

type RentInput = {
  date: string;
  time: string;
  dueDate: string;
  dueTime: string;
  customer: string;
  discount: string;
  fine: string;
  note: string;
};

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
  const [form, setForm] = useState<RentInput>({
    date: "",
    time: "",
    dueDate: "",
    dueTime: "",
    customer: "",
    discount: "",
    fine: "",
    note: "",
  });
  const [preset, setPreset] = useState("24h");
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<Bike | null>(null);
  if (bike !== last) {
    setLast(bike);
    if (bike) {
      const time = date === today ? nowTime() : "09:00";
      setForm({ date, time, dueDate: addDays(date, 1), dueTime: time, customer: "", discount: "", fine: "", note: "" });
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

          <div className="grid grid-cols-2 gap-3">
            <Field label="ส่วนลด (ไม่บังคับ)">
              <Input
                type="number"
                inputMode="decimal"
                min="0"
                placeholder="0"
                value={form.discount}
                onChange={(e) => setForm((f) => ({ ...f, discount: e.target.value }))}
              />
            </Field>
            <Field label="ค่าปรับ (ไม่บังคับ)">
              <Input
                type="number"
                inputMode="decimal"
                min="0"
                placeholder="0"
                value={form.fine}
                onChange={(e) => setForm((f) => ({ ...f, fine: e.target.value }))}
              />
            </Field>
            <Field label="หมายเหตุ (ไม่บังคับ)" className="col-span-2">
              <Input
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                placeholder="เช่น มัดจำ 1,000 / ถ่ายรูปรถแล้ว / ใบขับขี่"
              />
            </Field>
          </div>

          <div className="rounded-xl bg-brand-soft px-4 py-3 text-brand-ink">
            <div className="flex items-center justify-between">
              <span className="text-sm">
                เช่า {days} วัน · คืน {dueText(form.dueDate, form.dueTime, today)}
                {(Number(form.discount) > 0 || Number(form.fine) > 0) && (
                  <span className="block text-xs opacity-80">
                    {baht(days * bike.dailyRate)}
                    {Number(form.discount) > 0 && ` − ลด ${baht(Number(form.discount))}`}
                    {Number(form.fine) > 0 && ` + ปรับ ${baht(Number(form.fine))}`}
                  </span>
                )}
              </span>
              <span className="tabular text-xl font-bold">
                {baht(days * bike.dailyRate - (Number(form.discount) || 0) + (Number(form.fine) || 0))}
              </span>
            </div>
            {days > 1 && <p className="mt-1 text-xs opacity-80">ระบบจะลงบันทึกให้ทุกวัน ({days} วัน) คิดเงินรายวัน</p>}
          </div>
        </div>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------- คืนรถ

type ReturnInput = { date: string; time: string; discount: number; fine: number; note: string; days: number };

function ReturnDialog({
  rental,
  today,
  onClose,
  onSubmit,
}: {
  rental: Rental | null;
  today: string;
  onClose: () => void;
  onSubmit: (r: Rental, input: ReturnInput) => Promise<boolean>;
}) {
  // actual = คิดเงินตามวันที่ใช้จริง, booked = ตามที่ตกลงตอนเช่า
  const [form, setForm] = useState({ date: "", time: "", discount: "", fine: "", note: "", charge: "booked" });
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<Rental | null>(null);
  if (rental !== last) {
    setLast(rental);
    if (rental) {
      setForm({
        date: today,
        time: nowTime(),
        discount: rental.discount ? String(rental.discount) : "",
        fine: rental.fine ? String(rental.fine) : "",
        note: rental.note,
        charge: "booked",
      });
    }
  }
  if (!rental) return <Modal open={false} onClose={onClose} title="">{null}</Modal>;

  const late = rental.dueDate ? overdueMinutes(rental, form.date || today, form.time || nowTime()) : 0;
  const timeOk = /^\d{1,2}:\d{2}$/.test(form.time);
  const used = form.date >= rental.date && timeOk ? usedDays(rental, form.date, form.time) : rental.days;
  // จำนวนวันที่ใช้จริงไม่ตรงกับที่ตกลง (คืนก่อน/หลังกำหนด) → ให้เลือกคิดเงินแบบไหน
  const differs = used !== rental.days;
  const days = differs && form.charge === "actual" ? used : rental.days;
  const totalFor = (n: number) =>
    rentalTotal({ days: n, price: rental.price, discount: Number(form.discount) || 0, fine: Number(form.fine) || 0 });
  const valid =
    !!form.date &&
    form.date >= rental.date &&
    timeOk &&
    Number(form.discount || 0) >= 0 &&
    Number(form.fine || 0) >= 0;

  const submit = async () => {
    setBusy(true);
    const ok = await onSubmit(rental, {
      date: form.date,
      time: form.time,
      discount: Number(form.discount) || 0,
      fine: Number(form.fine) || 0,
      note: form.note.trim(),
      days,
    });
    setBusy(false);
    if (ok) onClose();
  };

  const choice = (on: boolean, title: string, sub: string, onClick: () => void) => (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 cursor-pointer rounded-xl border px-3 py-2.5 text-left transition",
        on ? "border-brand bg-brand-soft text-brand-ink" : "border-line text-ink-2 hover:border-brand/50",
      )}
    >
      <span className="block text-sm font-semibold">{title}</span>
      <span className="text-xs opacity-80">{sub}</span>
    </button>
  );

  return (
    <Modal
      open={!!rental}
      onClose={onClose}
      title={`คืนรถ ${rental.plate}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button disabled={!valid || busy} onClick={submit}>
            <CheckCheck className="size-4" /> {busy ? "กำลังบันทึก…" : "บันทึกการคืนรถ"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <p className="-mt-1 text-sm text-muted">
          เช่า {thShort(rental.date)} {rental.time}
          {rental.dueDate && ` · กำหนดคืน ${dueText(rental.dueDate, rental.dueTime, today)}`}
          {rental.customer && ` · ${rental.customer}`}
        </p>
        {late > 0 && (
          <p className="-mt-2 flex items-center gap-1.5 rounded-xl bg-bad-soft px-3 py-2 text-sm text-bad">
            <AlarmClock className="size-4 shrink-0" /> คืนช้ากว่ากำหนด {durationText(late)} — ใส่ค่าปรับได้ (ไม่บังคับ)
          </p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="วันที่คืน">
            <Input
              type="date"
              min={rental.date}
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            />
          </Field>
          <Field label="เวลาที่คืน">
            <Input type="time" value={form.time} onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))} />
          </Field>
        </div>

        {differs && (
          <div>
            <p className="mb-2 text-xs font-medium text-ink-2">
              {used < rental.days ? "คืนก่อนกำหนด" : "คืนช้ากว่ากำหนด"} — ตกลงไว้ {rental.days} วัน แต่ใช้จริง {used} วัน
            </p>
            <div className="flex gap-2">
              {choice(form.charge === "booked", `คิด ${rental.days} วัน ตามที่ตกลง`, baht(totalFor(rental.days)), () =>
                setForm((f) => ({ ...f, charge: "booked" })),
              )}
              {choice(form.charge === "actual", `คิด ${used} วัน ตามที่ใช้จริง`, baht(totalFor(used)), () =>
                setForm((f) => ({ ...f, charge: "actual" })),
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="ส่วนลด (ไม่บังคับ)">
            <Input
              type="number"
              inputMode="decimal"
              min="0"
              placeholder="0"
              value={form.discount}
              onChange={(e) => setForm((f) => ({ ...f, discount: e.target.value }))}
            />
          </Field>
          <Field label="ค่าปรับ (ไม่บังคับ)">
            <Input
              type="number"
              inputMode="decimal"
              min="0"
              placeholder="0"
              value={form.fine}
              onChange={(e) => setForm((f) => ({ ...f, fine: e.target.value }))}
            />
          </Field>
          <Field label="หมายเหตุ (ไม่บังคับ)" className="col-span-2">
            <Textarea
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              placeholder="เช่น คืนช้า / ยางแบน / รถมีรอย / คืนมัดจำแล้ว"
            />
          </Field>
        </div>

        <div className="flex items-center justify-between rounded-xl bg-good-soft px-4 py-3 text-good">
          <span className="text-sm">
            ยอดรวมการเช่านี้
            <span className="block text-xs opacity-80">
              {days} วัน × {baht(rental.price)}
            </span>
          </span>
          <span className="tabular text-xl font-bold">{baht(totalFor(days))}</span>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- แท็บคืนรถ

function bikeLabel(bikes: Bike[], id: string) {
  const b = bikes.find((x) => x.id === id);
  return b ? `${b.brand} ${b.model}` : "";
}

function ReturnTab({
  outstanding,
  returnedToday,
  bikes,
  today,
  now,
  searching,
  onReturn,
  onUnreturn,
  onEdit,
  onGoRent,
}: {
  outstanding: Rental[];
  returnedToday: Rental[];
  bikes: Bike[];
  today: string;
  now: string;
  searching: boolean;
  onReturn: (r: Rental) => void;
  onUnreturn: (r: Rental) => void;
  onEdit: (r: Rental) => void;
  onGoRent: () => void;
}) {
  const late = outstanding.filter((r) => (minutesUntilDue(r, today, now) ?? 1) < 0).length;
  return (
    <div className="space-y-8">
      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold">ยังไม่คืน · {outstanding.length} คัน</h2>
            <p className="text-sm text-muted">
              {late > 0 ? <span className="font-semibold text-bad">เลยกำหนด {late} คัน · </span> : null}
              เรียงจากคันที่ต้องคืนก่อน — กด “รับรถคืน” เมื่อลูกค้านำรถมาคืน
            </p>
          </div>
        </div>
        {outstanding.length === 0 ? (
          <Card>
            <Empty
              icon={<KeyRound />}
              image="/illustrations/scooter.svg"
              title={searching ? "ไม่พบรถที่ค้นหาในรายการที่ยังไม่คืน" : "ไม่มีรถค้างคืน — รถกลับมาครบแล้ว"}
              hint={searching ? "ลองค้นด้วยทะเบียนบางส่วน เช่น 8245" : undefined}
            />
            {!searching && (
              <div className="-mt-6 pb-6 text-center">
                <Button variant="secondary" onClick={onGoRent}>
                  <Plus className="size-4" /> ไปแท็บเช่ารถ
                </Button>
              </div>
            )}
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {outstanding.map((r) => {
              const left = minutesUntilDue(r, today, now);
              const tone = left == null ? "none" : left < 0 ? "late" : left <= 180 ? "soon" : "ok";
              return (
                <div
                  key={r.id}
                  className={cn(
                    "flex flex-col gap-3 rounded-2xl border p-4",
                    tone === "late"
                      ? "border-bad/50 bg-bad-soft/60"
                      : tone === "soon"
                        ? "border-warn/50 bg-warn-soft/60"
                        : "border-line bg-surface",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-lg font-bold tracking-wide">{r.plate}</p>
                      <p className="truncate text-sm text-muted">
                        {bikeLabel(bikes, r.bikeId)}
                        {r.customer && (
                          <span className="ml-1 inline-flex items-center gap-1 text-ink-2">
                            · <User className="size-3" /> {r.customer}
                          </span>
                        )}
                      </p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => onEdit(r)} aria-label="แก้ไขรายละเอียด">
                      <Pencil className="size-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-xl bg-surface/70 px-3 py-2">
                      <p className="text-[11px] text-muted">ยืมเมื่อ</p>
                      <p className="font-medium">
                        {thShort(r.date)} {r.time}
                      </p>
                    </div>
                    <div className="rounded-xl bg-surface/70 px-3 py-2">
                      <p className="text-[11px] text-muted">กำหนดคืน</p>
                      <p className={cn("font-medium", tone === "late" && "text-bad", tone === "soon" && "text-warn")}>
                        {r.dueDate ? dueText(r.dueDate, r.dueTime, today) : "ไม่ได้กำหนด"}
                      </p>
                    </div>
                  </div>
                  {left != null && (
                    <p
                      className={cn(
                        "flex items-center gap-1.5 text-sm font-semibold",
                        tone === "late" ? "text-bad" : tone === "soon" ? "text-warn" : "text-ink-2",
                      )}
                    >
                      <AlarmClock className="size-4" />
                      {left < 0 ? `เลยกำหนดมา ${durationText(-left)}` : `อีก ${durationText(left)} ถึงเวลาคืน`}
                    </p>
                  )}
                  <Button size="lg" className="w-full" onClick={() => onReturn(r)}>
                    <KeyRound className="size-5" /> รับรถคืน
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold">คืนแล้ววันนี้ · {returnedToday.length} คัน</h2>
        {returnedToday.length === 0 ? (
          <p className="text-sm text-muted">ยังไม่มีรถคืนวันนี้</p>
        ) : (
          <Card className="divide-y divide-line overflow-hidden">
            {returnedToday.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-good-soft text-good">
                  <CheckCheck className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {r.plate} <span className="text-xs font-normal text-muted">{bikeLabel(bikes, r.bikeId)}</span>
                  </p>
                  <p className="truncate text-xs text-muted">
                    ยืม {thShort(r.date)} {r.time} · คืน {returnedText(r)}
                    {r.customer && ` · ${r.customer}`}
                  </p>
                </div>
                <span className="tabular text-sm font-semibold">{baht(r.total)}</span>
                <button
                  onClick={() => onUnreturn(r)}
                  className="flex cursor-pointer items-center gap-1 text-xs text-muted hover:text-ink"
                >
                  <Undo2 className="size-3.5" /> ยกเลิกการคืน
                </button>
              </div>
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}
