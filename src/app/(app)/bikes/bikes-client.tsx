"use client";

import { Bike as BikeIcon, LayoutGrid, List, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { deleteBike, saveBike } from "@/app/actions";
import { ExpiryBadge, StatusBadge, expiryState } from "@/components/bike-badges";
import { Button, Card, Empty, Field, Input, Modal, Segmented, Select, Textarea, cn } from "@/components/ui";
import { thShort } from "@/lib/dates";
import { baht } from "@/lib/format";
import { useAction } from "@/lib/hooks";
import { confirmDialog } from "@/lib/confirm";
import { BIKE_STATUSES, type Bike } from "@/lib/schema";

type Stats = Record<string, { monthDays: number; monthRevenue: number; totalRevenue: number; lastDate: string }>;

const EMPTY: Partial<Bike> = { status: "เช่า", dailyRate: 350, province: "ตราด", transferKit: "" };

export function BikesClient({ bikes, stats, today }: { bikes: Bike[]; stats: Stats; today: string }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("ทั้งหมด");
  const [view, setView] = useState<"grid" | "table">("grid");
  const [editing, setEditing] = useState<Partial<Bike> | null>(null);

  const statuses = useMemo(() => {
    const set = new Set<string>(bikes.map((b) => b.status).filter(Boolean));
    return ["ทั้งหมด", ...set, "แจ้งเตือน"];
  }, [bikes]);

  const alertOf = (b: Bike) =>
    b.status !== "ซากรถ" &&
    b.status !== "ขายแล้ว" &&
    ["bad", "warn"].includes(expiryState(b.taxExpiry, today)?.tone ?? "");

  const list = bikes.filter((b) => {
    if (status === "แจ้งเตือน" ? !alertOf(b) : status !== "ทั้งหมด" && b.status !== status) return false;
    const s = `${b.plate} ${b.brand} ${b.model} ${b.owner} ${b.transferTo}`.toLowerCase();
    return s.includes(q.toLowerCase());
  });

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1 basis-60">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ค้นหาทะเบียน ยี่ห้อ รุ่น ชื่อเจ้าของ…"
            className="pl-9"
          />
        </div>
        <Segmented
          className="max-sm:hidden"
          value={view}
          onChange={setView}
          options={[
            { value: "grid", label: <LayoutGrid className="size-4" /> },
            { value: "table", label: <List className="size-4" /> },
          ]}
        />
        <Button onClick={() => setEditing({ ...EMPTY })}>
          <Plus className="size-4" /> เพิ่มรถ
        </Button>
      </div>

      <div className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {statuses.map((s) => {
          const count =
            s === "ทั้งหมด" ? bikes.length : s === "แจ้งเตือน" ? bikes.filter(alertOf).length : bikes.filter((b) => b.status === s).length;
          return (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={cn(
                "flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition",
                status === s ? "border-brand bg-brand-soft text-brand-ink" : "border-line bg-surface text-ink-2 hover:border-muted",
              )}
            >
              {s === "แจ้งเตือน" ? "⚠ ภาษีใกล้หมด/หมดแล้ว" : s}
              <span className="text-xs text-muted">{count}</span>
            </button>
          );
        })}
      </div>

      {list.length === 0 ? (
        <Card>
          <Empty icon={<BikeIcon />} title="ไม่พบรถ" hint="ลองเปลี่ยนคำค้นหรือตัวกรอง หรือเพิ่มรถคันใหม่" />
        </Card>
      ) : view === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((b) => {
            const s = stats[b.id];
            return (
              <Card
                key={b.id}
                onClick={() => setEditing(b)}
                className="group cursor-pointer p-5 transition hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-lg hover:shadow-brand/5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold tracking-wide text-muted">{b.brand}</p>
                    <p className="truncate font-semibold">{b.model || "-"}</p>
                  </div>
                  <StatusBadge status={b.status} />
                </div>
                <div className="my-4 inline-flex rounded-lg border-2 border-ink/80 bg-surface px-3 py-1 text-lg font-bold tracking-wide">
                  {b.plate}
                  {b.province && <span className="ml-2 self-end text-xs font-medium text-muted">{b.province}</span>}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <ExpiryBadge date={b.taxExpiry} today={today} prefix="ภาษี" />
                  {b.cardExpiry && <ExpiryBadge date={b.cardExpiry} today={today} prefix="บัตร" />}
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-4 text-center">
                  <div>
                    <p className="text-[11px] text-muted">ค่าเช่า/วัน</p>
                    <p className="tabular font-semibold">{b.dailyRate ? baht(b.dailyRate) : "-"}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted">เช่าเดือนนี้</p>
                    <p className="tabular font-semibold">{s?.monthDays ?? 0} วัน</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted">รายได้สะสม</p>
                    <p className="tabular font-semibold">{baht(s?.totalRevenue ?? 0)}</p>
                  </div>
                </div>
                {(b.owner || b.transferTo) && (
                  <p className="mt-3 truncate text-xs text-muted">
                    เจ้าของ: {b.owner || "-"} {b.transferTo && `→ ${b.transferTo}`}
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                {["ทะเบียน", "ยี่ห้อ / รุ่น", "สถานะ", "ภาษีหมด", "บัตรหมดอายุ", "ชุดโอน", "เจ้าของ → โอนให้", "ค่าเช่า", "เช่าล่าสุด", ""].map((h) => (
                  <th key={h} className="px-4 py-3 font-medium whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((b) => (
                <tr key={b.id} className="border-b border-line last:border-0 hover:bg-surface-2/60">
                  <td className="px-4 py-3 font-semibold whitespace-nowrap">{b.plate}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {b.brand} <span className="text-muted">{b.model}</span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={b.status} />
                  </td>
                  <td className="px-4 py-3">
                    <ExpiryBadge date={b.taxExpiry} today={today} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-ink-2">{thShort(b.cardExpiry)}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-ink-2">{b.transferKit || "-"}</td>
                  <td className="max-w-64 truncate px-4 py-3 text-ink-2">
                    {b.owner || "-"} {b.transferTo && <span className="text-muted">→ {b.transferTo}</span>}
                  </td>
                  <td className="tabular px-4 py-3 whitespace-nowrap">{b.dailyRate ? baht(b.dailyRate) : "-"}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-ink-2">{thShort(stats[b.id]?.lastDate ?? "")}</td>
                  <td className="px-4 py-3">
                    <Button variant="ghost" size="icon" onClick={() => setEditing(b)} aria-label="แก้ไข">
                      <Pencil className="size-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <BikeForm bike={editing} onClose={() => setEditing(null)} />
    </>
  );
}

function BikeForm({ bike, onClose }: { bike: Partial<Bike> | null; onClose: () => void }) {
  const { pending, run } = useAction();
  const [form, setForm] = useState<Partial<Bike>>({});
  const [lastBike, setLastBike] = useState(bike);
  if (bike !== lastBike) {
    setLastBike(bike);
    setForm(bike ?? {});
  }
  const set = (k: keyof Bike) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Modal
      open={!!bike}
      onClose={onClose}
      wide
      title={bike?.id ? `แก้ไข ${bike.plate}` : "เพิ่มรถใหม่"}
      footer={
        <>
          {bike?.id && (
            <Button
              variant="danger"
              className="mr-auto"
              disabled={pending}
              onClick={async () => {
                const ok = await confirmDialog({
                  title: "ลบรถคันนี้?",
                  html: "ลบออกจากทะเบียนรถถาวร (รถที่มีประวัติเช่าจะลบไม่ได้)",
                  confirmText: "ลบรถ",
                  danger: true,
                });
                if (ok) run(() => deleteBike(bike.id!), "ลบรถแล้ว", onClose);
              }}
            >
              <Trash2 className="size-4" /> ลบ
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button disabled={pending} onClick={() => run(() => saveBike(form), "บันทึกแล้ว", onClose)}>
            {pending ? "กำลังบันทึก…" : "บันทึก"}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="ทะเบียน *">
          <Input value={form.plate ?? ""} onChange={set("plate")} placeholder="1กญ - 8253" />
        </Field>
        <Field label="จังหวัด">
          <Input value={form.province ?? ""} onChange={set("province")} />
        </Field>
        <Field label="ยี่ห้อ">
          <Input value={form.brand ?? ""} onChange={set("brand")} placeholder="HONDA" list="brands" />
          <datalist id="brands">
            {["HONDA", "YAMAHA", "GPX", "MALAGUTI", "SUZUKI", "VESPA"].map((b) => (
              <option key={b} value={b} />
            ))}
          </datalist>
        </Field>
        <Field label="รุ่น / ซีซี">
          <Input value={form.model ?? ""} onChange={set("model")} placeholder="Click 125 i" />
        </Field>
        <Field label="สถานะ">
          <Select value={form.status ?? ""} onChange={set("status")}>
            {BIKE_STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
        </Field>
        <Field label="ราคาเช่า/วัน (บาท)">
          <Input type="number" inputMode="decimal" value={form.dailyRate ?? ""} onChange={set("dailyRate")} />
        </Field>
        <Field label="ภาษีหมด">
          <Input type="date" value={form.taxExpiry ?? ""} onChange={set("taxExpiry")} />
        </Field>
        <Field label="บัตรหมดอายุ">
          <Input type="date" value={form.cardExpiry ?? ""} onChange={set("cardExpiry")} />
        </Field>
        <Field label="ที่มารถ">
          <Input value={form.source ?? ""} onChange={set("source")} list="sources" placeholder="อลิส / ประมูล / ซื้อร้าน" />
          <datalist id="sources">
            {["อลิส", "ประมูล", "ซื้อร้าน"].map((b) => (
              <option key={b} value={b} />
            ))}
          </datalist>
        </Field>
        <Field label="ชุดโอนต่อ">
          <Select value={form.transferKit ?? ""} onChange={set("transferKit")}>
            <option value="">-</option>
            <option>โอนแล้ว</option>
            <option>ยังไม่โอน</option>
            <option>รอเอกสาร</option>
          </Select>
        </Field>
        <Field label="ชื่อเจ้าของ (ในเล่ม)">
          <Input value={form.owner ?? ""} onChange={set("owner")} />
        </Field>
        <Field label="พร้อมโอนให้ใคร">
          <Input value={form.transferTo ?? ""} onChange={set("transferTo")} />
        </Field>
        <Field label="หมายเหตุ" className="sm:col-span-2">
          <Textarea value={form.note ?? ""} onChange={set("note")} />
        </Field>
      </div>
    </Modal>
  );
}
