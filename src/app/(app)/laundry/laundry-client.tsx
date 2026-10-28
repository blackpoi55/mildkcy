"use client";

import { CheckCircle2, CircleDashed, Minus, Plus, Shirt, Trash2 } from "lucide-react";
import { useState } from "react";
import { deleteLaundry, saveLaundry, setLaundryPaid } from "@/app/actions";
import { DateNav } from "@/components/date-nav";
import { Badge, Button, Card, CardHeader, Empty, Field, Input, Modal, Segmented, cn } from "@/components/ui";
import { laundryPriceFor as priceFor, type AppSettings } from "@/lib/laundry";
import { nowTime, thMonth, thShort } from "@/lib/dates";
import { baht, number } from "@/lib/format";
import { useAction } from "@/lib/hooks";
import type { Laundry } from "@/lib/schema";

const QUICK_KG = [1, 1.5, 2, 2.5, 3, 3.5, 4, 5];

export function LaundryClient({
  items,
  settings,
  date,
  today,
}: {
  items: Laundry[];
  settings: AppSettings;
  date: string;
  today: string;
}) {
  const [tab, setTab] = useState<"day" | "rooms">("day");
  const [editing, setEditing] = useState<Laundry | null>(null);
  const dayItems = items.filter((i) => i.date === date).sort((a, b) => b.time.localeCompare(a.time));

  return (
    <>
      <div className="mb-5">
        <DateNav date={date} period="day" today={today} />
      </div>
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[420px_minmax(0,1fr)]">
        <QuickEntry settings={settings} date={date} />
        <div className="min-w-0 space-y-4">
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { value: "day", label: `รายการวันนี้ (${dayItems.length})` },
              { value: "rooms", label: `สรุปรายห้อง · ${thMonth(date)}` },
            ]}
          />
          {tab === "day" ? (
            <DayList items={dayItems} onEdit={setEditing} />
          ) : (
            <RoomSummary items={items} rooms={settings.rooms} />
          )}
        </div>
      </div>
      <EditLaundry item={editing} settings={settings} onClose={() => setEditing(null)} />
    </>
  );
}

function KgStepper({ kg, setKg }: { kg: number; setKg: (n: number) => void }) {
  return (
    <div>
      <div className="flex items-center gap-3">
        <Button variant="secondary" size="lg" className="w-14" onClick={() => setKg(Math.max(0.5, kg - 0.5))} aria-label="ลด 0.5 กก.">
          <Minus className="size-5" />
        </Button>
        <div className="flex-1 rounded-2xl bg-surface-2 py-2 text-center">
          <span className="tabular text-3xl font-bold">{number(kg, 1)}</span>
          <span className="ml-1 text-sm text-muted">กก.</span>
        </div>
        <Button variant="secondary" size="lg" className="w-14" onClick={() => setKg(kg + 0.5)} aria-label="เพิ่ม 0.5 กก.">
          <Plus className="size-5" />
        </Button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {QUICK_KG.map((k) => (
          <button
            key={k}
            onClick={() => setKg(k)}
            className={cn(
              "cursor-pointer rounded-lg border px-3 py-1 text-sm font-medium transition",
              kg === k ? "border-laundry bg-laundry text-white" : "border-line text-ink-2 hover:border-muted",
            )}
          >
            {k}
          </button>
        ))}
      </div>
    </div>
  );
}

function QuickEntry({ settings, date }: { settings: AppSettings; date: string }) {
  const { pending, run } = useAction();
  const [room, setRoom] = useState("");
  const [kg, setKgRaw] = useState(1);
  const [price, setPrice] = useState(priceFor(settings, 1));
  const [paid, setPaid] = useState(false);
  const [note, setNote] = useState("");
  const setKg = (k: number) => {
    setKgRaw(k);
    setPrice(priceFor(settings, k));
  };

  const submit = () =>
    run(
      () => saveLaundry({ date, room, kg, price, paid, note, time: nowTime() }),
      `บันทึกห้อง ${room} · ${kg} กก. · ${baht(price)}`,
      () => {
        setRoom("");
        setNote("");
        setPaid(false);
      },
    );

  return (
    <Card className="p-5 lg:sticky lg:top-6">
      <h3 className="mb-4 flex items-center gap-2 font-semibold">
        <span className="grid size-8 place-items-center rounded-lg bg-laundry/15 text-laundry">
          <Shirt className="size-4" />
        </span>
        บันทึกซักผ้า · {thShort(date)}
      </h3>

      <p className="mb-2 text-xs font-medium text-ink-2">ห้อง</p>
      <div className="mb-5 grid grid-cols-5 gap-2">
        {settings.rooms.map((r) => (
          <button
            key={r}
            onClick={() => setRoom(r)}
            aria-pressed={room === r}
            className={cn(
              "h-12 cursor-pointer rounded-xl border text-lg font-semibold transition active:scale-95",
              room === r ? "border-brand bg-brand-2 text-white shadow-md shadow-brand/20" : "border-line bg-surface hover:border-brand/50",
            )}
          >
            {r}
          </button>
        ))}
      </div>

      <p className="mb-2 text-xs font-medium text-ink-2">น้ำหนัก</p>
      <KgStepper kg={kg} setKg={setKg} />

      <div className="mt-5 grid grid-cols-2 gap-3">
        <Field label="ราคา (บาท)">
          <Input type="number" inputMode="decimal" value={price} onChange={(e) => setPrice(Number(e.target.value))} />
        </Field>
        <Field label="การชำระ">
          <button
            onClick={() => setPaid(!paid)}
            className={cn(
              "flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border text-sm font-medium transition",
              paid ? "border-good bg-good-soft text-good" : "border-line text-ink-2",
            )}
          >
            {paid ? <CheckCircle2 className="size-4" /> : <CircleDashed className="size-4" />}
            {paid ? "ชำระแล้ว" : "ยังไม่ชำระ"}
          </button>
        </Field>
        <Field label="หมายเหตุ" className="col-span-2">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="เช่น ผ้าปูที่นอน, ด่วน" />
        </Field>
      </div>

      <Button size="lg" className="mt-5 w-full" disabled={!room || pending} onClick={submit}>
        {pending ? "กำลังบันทึก…" : room ? `บันทึก ห้อง ${room} · ${baht(price)}` : "เลือกห้องก่อน"}
      </Button>
    </Card>
  );
}

function DayList({ items, onEdit }: { items: Laundry[]; onEdit: (l: Laundry) => void }) {
  const total = items.reduce((s, i) => s + i.price, 0);
  const kg = items.reduce((s, i) => s + i.kg, 0);
  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-3 border-b border-line">
        {[
          ["รายการ", number(items.length)],
          ["น้ำหนักรวม", `${number(kg, 1)} กก.`],
          ["ยอดรวม", baht(total)],
        ].map(([l, v]) => (
          <div key={l} className="px-5 py-3">
            <p className="text-xs text-muted">{l}</p>
            <p className="tabular text-lg font-bold">{v}</p>
          </div>
        ))}
      </div>
      {items.length === 0 ? (
        <Empty icon={<Shirt />} title="ยังไม่มีรายการซักผ้าวันนี้" hint="เลือกห้องและน้ำหนักทางซ้ายเพื่อบันทึก" />
      ) : (
        <div className="divide-y divide-line">
          {items.map((i) => (
            <button
              key={i.id}
              onClick={() => onEdit(i)}
              className="flex w-full cursor-pointer items-center gap-4 px-5 py-3 text-left hover:bg-surface-2/60"
            >
              <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-laundry/15 text-lg font-bold text-laundry">
                {i.room}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  ห้อง {i.room} · {number(i.kg, 1)} กก.
                </p>
                <p className="truncate text-xs text-muted">{[i.time, i.note].filter(Boolean).join(" · ")}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <p className="tabular font-semibold">{baht(i.price)}</p>
                {i.paid ? <Badge tone="good">ชำระแล้ว</Badge> : <Badge tone="warn">ค้างชำระ</Badge>}
              </div>
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}

function RoomSummary({ items, rooms }: { items: Laundry[]; rooms: string[] }) {
  const { pending, run } = useAction();
  const all = [...new Set([...rooms, ...items.map((i) => i.room)])];
  const rows = all.map((room) => {
    const list = items.filter((i) => i.room === room);
    const unpaid = list.filter((i) => !i.paid);
    return {
      room,
      count: list.length,
      kg: list.reduce((s, i) => s + i.kg, 0),
      total: list.reduce((s, i) => s + i.price, 0),
      unpaid: unpaid.reduce((s, i) => s + i.price, 0),
      unpaidIds: unpaid.map((i) => i.id),
    };
  });
  const sum = rows.reduce((s, r) => ({ kg: s.kg + r.kg, total: s.total + r.total, unpaid: s.unpaid + r.unpaid }), {
    kg: 0,
    total: 0,
    unpaid: 0,
  });

  return (
    <Card className="overflow-hidden">
      <CardHeader title="สรุปรายห้องประจำเดือน" subtitle="กด 'รับเงินแล้ว' เพื่อปิดยอดค้างของห้องนั้นทั้งเดือน" className="pb-4" />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-y border-line text-left text-xs text-muted">
              <th className="px-5 py-2.5 font-medium">ห้อง</th>
              <th className="px-3 py-2.5 text-right font-medium">ครั้ง</th>
              <th className="px-3 py-2.5 text-right font-medium">กก.</th>
              <th className="px-3 py-2.5 text-right font-medium">ยอดรวม</th>
              <th className="px-3 py-2.5 text-right font-medium">ค้างชำระ</th>
              <th className="px-5 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.room} className={cn("border-b border-line last:border-0", !r.count && "text-muted")}>
                <td className="px-5 py-2.5 font-semibold">ห้อง {r.room}</td>
                <td className="tabular px-3 text-right">{r.count || "-"}</td>
                <td className="tabular px-3 text-right">{r.kg ? number(r.kg, 1) : "-"}</td>
                <td className="tabular px-3 text-right font-medium">{r.total ? baht(r.total) : "-"}</td>
                <td className={cn("tabular px-3 text-right", r.unpaid > 0 && "font-semibold text-warn")}>
                  {r.unpaid ? baht(r.unpaid) : "-"}
                </td>
                <td className="px-5 py-1.5 text-right">
                  {r.unpaid > 0 && (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={pending}
                      onClick={() => run(() => setLaundryPaid(r.unpaidIds, true), `ห้อง ${r.room} ชำระครบแล้ว`)}
                    >
                      รับเงินแล้ว
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-line bg-surface-2/50 font-semibold">
              <td className="px-5 py-3">รวม</td>
              <td />
              <td className="tabular px-3 text-right">{number(sum.kg, 1)}</td>
              <td className="tabular px-3 text-right text-laundry">{baht(sum.total)}</td>
              <td className="tabular px-3 text-right text-warn">{sum.unpaid ? baht(sum.unpaid) : "-"}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  );
}

function EditLaundry({ item, settings, onClose }: { item: Laundry | null; settings: AppSettings; onClose: () => void }) {
  const { pending, run } = useAction();
  const [form, setForm] = useState<Laundry | null>(null);
  const [last, setLast] = useState(item);
  if (item !== last) {
    setLast(item);
    setForm(item);
  }
  if (!form) return <Modal open={false} onClose={onClose} title="">{null}</Modal>;
  return (
    <Modal
      open={!!item}
      onClose={onClose}
      title={`แก้ไขรายการ ห้อง ${form.room}`}
      footer={
        <>
          <Button
            variant="danger"
            className="mr-auto"
            disabled={pending}
            onClick={() => run(() => deleteLaundry(form.id), "ลบรายการแล้ว", onClose)}
          >
            <Trash2 className="size-4" /> ลบ
          </Button>
          <Button variant="secondary" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button disabled={pending} onClick={() => run(() => saveLaundry(form), "บันทึกแล้ว", onClose)}>
            บันทึก
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <Field label="ห้อง">
            <select
              value={form.room}
              onChange={(e) => setForm({ ...form, room: e.target.value })}
              className="h-10 w-full rounded-xl border border-line bg-surface px-3 text-base sm:text-sm"
            >
              {[...new Set([...settings.rooms, form.room])].map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </Field>
          <Field label="วันที่" className="col-span-2">
            <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </Field>
        </div>
        <KgStepper kg={form.kg} setKg={(kg) => setForm({ ...form, kg, price: priceFor(settings, kg) })} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="ราคา (บาท)">
            <Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} />
          </Field>
          <Field label="เวลา">
            <Input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
          </Field>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" checked={form.paid} onChange={(e) => setForm({ ...form, paid: e.target.checked })} className="size-4 accent-[var(--brand)]" />
          ชำระเงินแล้ว
        </label>
        <Field label="หมายเหตุ">
          <Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}
