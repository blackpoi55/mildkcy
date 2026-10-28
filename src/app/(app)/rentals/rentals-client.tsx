"use client";

import { Check, Clock, ListChecks, Pencil, Plus, Receipt, Rows3, Table2, Trash2, User } from "lucide-react";
import { useMemo, useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteRental, restoreRentals, saveRental, setRentalDay } from "@/app/actions";
import { DateNav, useSetParam } from "@/components/date-nav";
import { Badge, Button, Card, Empty, Field, Input, Modal, Segmented, Select, Textarea, cn } from "@/components/ui";
import { confirmDialog } from "@/lib/confirm";
import { TH_DAYS_SHORT, nowTime, rangeOf, thLong, thShort, type Period } from "@/lib/dates";
import { baht } from "@/lib/format";
import { useAction } from "@/lib/hooks";
import { rentalTotal, type Bike, type Rental } from "@/lib/schema";

export type RentalView = "day" | "week" | "list";

const escapeHtml = (t: string) => t.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

type Toggle = { bike: Bike; date: string; rented: boolean };

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

  const [items, applyToggle] = useOptimistic(rentals, (state, t: Toggle) =>
    t.rented
      ? [
          ...state,
          {
            id: `tmp-${t.bike.id}-${t.date}`,
            date: t.date,
            time: nowTime(),
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
      applyToggle({ bike, date: d, rented });
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

  /** การยกเลิกเช่าต้องยืนยันก่อน กันเผลอกด */
  const toggle = async (bike: Bike, d: string, rented: boolean) => {
    if (!rented) {
      const recs = items.filter((r) => r.bikeId === bike.id && r.date === d);
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

      {view === "day" && <DayBoard bikes={bikes} rentals={items} date={date} onToggle={toggle} onEdit={setEditing} />}
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
    </>
  );
}

// ---------------------------------------------------------------- รายวัน

function DayBoard({
  bikes,
  rentals,
  date,
  onToggle,
  onEdit,
}: {
  bikes: Bike[];
  rentals: Rental[];
  date: string;
  onToggle: (b: Bike, d: string, rented: boolean) => void;
  onEdit: (r: Rental) => void;
}) {
  const todays = rentals.filter((r) => r.date === date);
  const byBike = new Map(todays.map((r) => [r.bikeId, r]));
  const rentedCount = bikes.filter((b) => byBike.has(b.id)).length;
  const revenue = todays.reduce((s, r) => s + r.total, 0);

  return (
    <>
      <div className="mb-5 grid grid-cols-3 gap-3">
        <MiniStat label="รถถูกเช่า" value={`${rentedCount}/${bikes.length}`} />
        <MiniStat label="ว่าง" value={String(bikes.length - rentedCount)} />
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
            return (
              <div
                key={b.id}
                className={cn(
                  "relative flex items-center gap-4 rounded-2xl border p-4 transition",
                  on ? "border-brand bg-brand-soft/60 shadow-md shadow-brand/10" : "border-line bg-surface",
                )}
              >
                <button
                  onClick={() => onToggle(b, date, !on)}
                  aria-pressed={on}
                  aria-label={on ? `ยกเลิกการเช่า ${b.plate}` : `บันทึกเช่า ${b.plate}`}
                  className={cn(
                    "grid size-14 shrink-0 cursor-pointer place-items-center rounded-2xl border-2 transition active:scale-95",
                    on ? "border-brand bg-brand-2 text-white" : "border-dashed border-line text-muted hover:border-brand hover:text-brand",
                  )}
                >
                  {on ? <Check className="size-7" strokeWidth={3} /> : <Plus className="size-6" />}
                </button>
                <button
                  className="min-w-0 flex-1 cursor-pointer text-left"
                  onClick={() => (on ? !r.id.startsWith("tmp-") && onEdit(r) : onToggle(b, date, true))}
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
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-muted">ว่าง · {baht(b.dailyRate)}/วัน</p>
                  )}
                </button>
                {on && !r.id.startsWith("tmp-") && (
                  <Button variant="ghost" size="icon" onClick={() => onEdit(r)} aria-label="แก้ไขรายละเอียด">
                    <Pencil className="size-4" />
                  </Button>
                )}
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
                              <Check className="size-4" strokeWidth={3} />
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

function RentalForm({ rental, bikes, onClose }: { rental: Partial<Rental> | null; bikes: Bike[]; onClose: () => void }) {
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
        <Field label="วันที่">
          <Input type="date" value={form.date ?? ""} onChange={set("date")} />
        </Field>
        <Field label="เวลา">
          <Input type="time" value={form.time ?? ""} onChange={set("time")} />
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
