"use client";

import { ArrowDown, ArrowUp, Bike as BikeIcon, CheckCircle2, Download, Search, Shirt, Trash2, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import {
  deleteLaundryMany,
  deleteRentals,
  restoreLaundry,
  restoreRentals,
  setLaundryPaid,
} from "@/app/actions";
import { Badge, Button, Card, Empty, Input, Segmented, Select, cn } from "@/components/ui";
import { confirmDialog } from "@/lib/confirm";
import { addDays, addMonths, nowTime, startOfMonth, thShort } from "@/lib/dates";
import { baht, number } from "@/lib/format";
import type { AppSettings } from "@/lib/laundry";
import { overdueMinutes } from "@/lib/rental-status";
import type { Bike, Laundry, Rental } from "@/lib/schema";
import { EditLaundry } from "../laundry/laundry-client";
import { RentalForm } from "../rentals/rentals-client";

export type RecordsTab = "rent" | "laundry";

type Tone = "neutral" | "brand" | "good" | "warn" | "bad";

/** สถานะการเช่าแบบอ่านง่าย */
function rentStatus(r: Rental, today: string, now: string): { key: string; label: string; tone: Tone } {
  if (r.days <= 0) return { key: "adjust", label: "ปรับยอด", tone: "neutral" };
  if (r.returnTime) return { key: "returned", label: `คืนแล้ว ${r.returnTime}`, tone: "good" };
  if (overdueMinutes(r, today, now) > 0) return { key: "overdue", label: "เลยกำหนด", tone: "bad" };
  if (r.dueDate || r.date >= today) return { key: "active", label: "กำลังเช่า", tone: "brand" };
  return { key: "done", label: "จบแล้ว", tone: "neutral" };
}

const RENT_STATUS = [
  { value: "", label: "ทุกสถานะ" },
  { value: "active", label: "กำลังเช่า" },
  { value: "overdue", label: "เลยกำหนด" },
  { value: "returned", label: "คืนแล้ว" },
  { value: "done", label: "จบแล้ว (ข้อมูลเก่า)" },
  { value: "adjust", label: "ปรับยอด" },
];
const LAUNDRY_STATUS = [
  { value: "", label: "ทุกสถานะ" },
  { value: "unpaid", label: "ค้างชำระ" },
  { value: "paid", label: "ชำระแล้ว" },
];

type SortKey = "date" | "name" | "amount";
const PAGE = 200;

function downloadCsv(name: string, header: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // ใส่ BOM ให้ Excel อ่านภาษาไทยถูก
  const csv = "﻿" + [header, ...rows].map((r) => r.map(esc).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  a.click();
  URL.revokeObjectURL(url);
}

export function RecordsClient({
  tab,
  from,
  to,
  today,
  rentals,
  laundry,
  bikes,
  settings,
}: {
  tab: RecordsTab;
  from: string;
  to: string;
  today: string;
  rentals: Rental[];
  laundry: Laundry[];
  bikes: Bike[];
  settings: AppSettings;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [navPending, startNav] = useTransition();
  const [pending, start] = useTransition();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "date", dir: -1 });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [limit, setLimit] = useState(PAGE);
  const [editRental, setEditRental] = useState<Rental | null>(null);
  const [editLaundry, setEditLaundry] = useState<Laundry | null>(null);
  const now = nowTime();

  const go = (params: Record<string, string>) => {
    const p = new URLSearchParams({ tab, ...(from ? { from, to } : { all: "1" }), ...params });
    if (params.all) {
      p.delete("from");
      p.delete("to");
    } else if (params.from) p.delete("all");
    setSelected(new Set());
    setLimit(PAGE);
    startNav(() => router.push(`${pathname}?${p}`, { scroll: false }));
  };

  const presets = [
    { label: "วันนี้", from: today, to: today },
    { label: "7 วันล่าสุด", from: addDays(today, -6), to: today },
    { label: "เดือนนี้", from: startOfMonth(today), to: addDays(addMonths(startOfMonth(today), 1), -1) },
    { label: "เดือนก่อน", from: addMonths(startOfMonth(today), -1), to: addDays(startOfMonth(today), -1) },
    { label: "3 เดือน", from: addMonths(startOfMonth(today), -2), to: addDays(addMonths(startOfMonth(today), 1), -1) },
  ];

  // ---------------------------------------------------------------- กรอง + เรียง
  const needle = q.trim().toLowerCase();
  const rentRows = useMemo(() => {
    const list = rentals.filter((r) => {
      if (status && rentStatus(r, today, now).key !== status) return false;
      if (!needle) return true;
      return `${r.plate} ${r.customer} ${r.note} ${r.date}`.toLowerCase().includes(needle);
    });
    const val = (r: Rental) =>
      sort.key === "date" ? `${r.date} ${r.time}` : sort.key === "name" ? r.plate : String(r.total).padStart(12, "0");
    return list.sort((a, b) => val(a).localeCompare(val(b), "th") * sort.dir);
  }, [rentals, status, needle, sort, today, now]);

  const washRows = useMemo(() => {
    const list = laundry.filter((l) => {
      if (status === "paid" && !l.paid) return false;
      if (status === "unpaid" && l.paid) return false;
      if (!needle) return true;
      return `ห้อง ${l.room} ${l.note} ${l.date}`.toLowerCase().includes(needle);
    });
    const val = (l: Laundry) =>
      sort.key === "date"
        ? `${l.date} ${l.time}`
        : sort.key === "name"
          ? l.room.padStart(4, "0")
          : String(l.price).padStart(12, "0");
    return list.sort((a, b) => val(a).localeCompare(val(b), "th") * sort.dir);
  }, [laundry, status, needle, sort]);

  const rows = tab === "rent" ? rentRows : washRows;
  const shown = rows.slice(0, limit);
  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggleOne = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const toggleAll = () => setSelected(allChecked ? new Set() : new Set(rows.map((r) => r.id)));

  const totals: { count: number; qty: string; sum: number; unpaid?: number } =
    tab === "rent"
      ? {
          count: rentRows.length,
          qty: `${number(rentRows.reduce((s, r) => s + r.days, 0), 1)} วัน`,
          sum: rentRows.reduce((s, r) => s + r.total, 0),
        }
      : {
          count: washRows.length,
          qty: `${number(washRows.reduce((s, l) => s + l.kg, 0), 1)} กก.`,
          sum: washRows.reduce((s, l) => s + l.price, 0),
          unpaid: washRows.filter((l) => !l.paid).reduce((s, l) => s + l.price, 0),
        };

  // ---------------------------------------------------------------- จัดการหลายรายการ
  const bulkDelete = async () => {
    const ids = [...selected];
    const ok = await confirmDialog({
      title: `ลบ ${ids.length} รายการ?`,
      html: "ลบออกจาก Google Sheet — กด “เลิกทำ” ได้ภายใน 10 วินาที",
      confirmText: "ลบรายการที่เลือก",
      danger: true,
    });
    if (!ok) return;
    start(async () => {
      if (tab === "rent") {
        const removed = rentals.filter((r) => selected.has(r.id));
        const res = await deleteRentals(ids);
        if (!res.ok) return void toast.error(res.error);
        setSelected(new Set());
        toast.success(`ลบ ${ids.length} รายการแล้ว`, {
          duration: 10_000,
          action: {
            label: "เลิกทำ",
            onClick: () => start(async () => void toastResult(await restoreRentals(removed), "คืนรายการแล้ว")),
          },
        });
      } else {
        const res = await deleteLaundryMany(ids);
        if (!res.ok) return void toast.error(res.error);
        const removed = res.data ?? [];
        setSelected(new Set());
        toast.success(`ลบ ${ids.length} รายการแล้ว`, {
          duration: 10_000,
          action: {
            label: "เลิกทำ",
            onClick: () => start(async () => void toastResult(await restoreLaundry(removed), "คืนรายการแล้ว")),
          },
        });
      }
    });
  };

  const bulkPaid = (paid: boolean) =>
    start(async () => {
      const res = await setLaundryPaid([...selected], paid);
      if (!res.ok) return void toast.error(res.error);
      toast.success(paid ? `ทำเครื่องหมายชำระแล้ว ${selected.size} รายการ` : "ทำเครื่องหมายค้างชำระแล้ว");
      setSelected(new Set());
    });

  const exportCsv = () => {
    const range = from ? `${from}_${to}` : "ทั้งหมด";
    if (tab === "rent") {
      downloadCsv(
        `เช่ารถ_${range}.csv`,
        ["วันที่ยืม", "เวลายืม", "ทะเบียน", "ลูกค้า", "กำหนดคืน", "เวลากำหนดคืน", "เวลาคืนจริง", "สถานะ", "จำนวนวัน", "ราคา/วัน", "ส่วนลด", "ค่าปรับ", "ยอดรวม", "หมายเหตุ"],
        rentRows.map((r) => [
          r.date, r.time, r.plate, r.customer, r.dueDate, r.dueTime, r.returnTime,
          rentStatus(r, today, now).label, r.days, r.price, r.discount, r.fine, r.total, r.note,
        ]),
      );
    } else {
      downloadCsv(
        `ซักผ้า_${range}.csv`,
        ["วันที่", "เวลา", "ห้อง", "น้ำหนัก (กก.)", "ราคา", "ชำระแล้ว", "หมายเหตุ"],
        washRows.map((l) => [l.date, l.time, l.room, l.kg, l.price, l.paid ? "ใช่" : "ยังไม่ชำระ", l.note]),
      );
    }
  };

  const sortHead = (key: SortKey, label: string, className?: string) => (
    <th className={cn("px-3 py-3 font-medium whitespace-nowrap", className)}>
      <button
        onClick={() => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : key === "date" ? -1 : 1 }))}
        className={cn("inline-flex cursor-pointer items-center gap-1 hover:text-ink", sort.key === key && "text-ink")}
      >
        {label}
        {sort.key === key && (sort.dir === 1 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
      </button>
    </th>
  );

  const check = (id: string) => (
    <input
      type="checkbox"
      checked={selected.has(id)}
      onChange={() => toggleOne(id)}
      onClick={(e) => e.stopPropagation()}
      className="size-4 cursor-pointer accent-[var(--brand)]"
      aria-label="เลือกรายการ"
    />
  );

  return (
    <div className={cn("space-y-4", navPending && "opacity-70")}>
      {/* ---------- ตัวกรอง ---------- */}
      <Card className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Segmented
            value={tab}
            onChange={(v) => {
              setStatus("");
              go({ tab: v });
            }}
            options={[
              { value: "rent", label: <span className="flex items-center gap-1.5"><BikeIcon className="size-4" />เช่ารถ</span> },
              { value: "laundry", label: <span className="flex items-center gap-1.5"><Shirt className="size-4" />ซักผ้า</span> },
            ]}
          />
          <Button variant="secondary" onClick={exportCsv} disabled={!rows.length}>
            <Download className="size-4" /> ดาวน์โหลด Excel (CSV)
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {presets.map((p) => (
            <button
              key={p.label}
              onClick={() => go({ from: p.from, to: p.to })}
              className={cn(
                "cursor-pointer rounded-full border px-3 py-1.5 text-sm font-medium transition",
                from === p.from && to === p.to ? "border-brand bg-brand-soft text-brand-ink" : "border-line text-ink-2 hover:border-muted",
              )}
            >
              {p.label}
            </button>
          ))}
          <button
            onClick={() => go({ all: "1" })}
            className={cn(
              "cursor-pointer rounded-full border px-3 py-1.5 text-sm font-medium transition",
              !from ? "border-brand bg-brand-soft text-brand-ink" : "border-line text-ink-2 hover:border-muted",
            )}
          >
            ทั้งหมด
          </button>
          <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-1.5 text-sm text-muted sm:flex sm:w-auto">
            <Input
              type="date"
              value={from}
              onChange={(e) => e.target.value && go({ from: e.target.value, to: to && to >= e.target.value ? to : e.target.value })}
              className="h-9 min-w-0 sm:!w-40"
              aria-label="ตั้งแต่วันที่"
            />
            ถึง
            <Input
              type="date"
              value={to}
              onChange={(e) => e.target.value && go({ from: from && from <= e.target.value ? from : e.target.value, to: e.target.value })}
              className="h-9 min-w-0 sm:!w-40"
              aria-label="ถึงวันที่"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-0 flex-1 basis-56">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={tab === "rent" ? "ค้นหาทะเบียน ลูกค้า หมายเหตุ…" : "ค้นหาห้อง หมายเหตุ…"}
              className="pl-9"
            />
          </div>
          <div className="w-full sm:w-52">
            <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="สถานะ">
              {(tab === "rent" ? RENT_STATUS : LAUNDRY_STATUS).map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </Card>

      {/* ---------- สรุป + จัดการหลายรายการ ---------- */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <p className="text-sm text-muted">
          {from ? `${thShort(from)} – ${thShort(to)}` : "ทุกช่วงเวลา"} · <b className="text-ink">{number(totals.count)}</b> รายการ ·{" "}
          {totals.qty} · รวม <b className="tabular text-ink">{baht(totals.sum)}</b>
          {!!totals.unpaid && <span className="text-warn"> · ค้างชำระ {baht(totals.unpaid)}</span>}
        </p>
      </div>

      {selected.size > 0 && (
        <div className="sticky top-16 z-20 flex flex-wrap items-center gap-2 rounded-2xl border border-brand/40 bg-brand-soft/95 px-4 py-2.5 shadow-lg backdrop-blur lg:top-4">
          <span className="text-sm font-semibold text-brand-ink">เลือก {selected.size} รายการ</span>
          <div className="ml-auto flex flex-wrap gap-2">
            {tab === "laundry" && (
              <Button size="sm" variant="secondary" disabled={pending} onClick={() => bulkPaid(true)}>
                <CheckCircle2 className="size-4" /> ชำระแล้ว
              </Button>
            )}
            <Button size="sm" variant="danger" disabled={pending} onClick={bulkDelete}>
              <Trash2 className="size-4" /> ลบ
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())} aria-label="ยกเลิกการเลือก">
              <X className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ---------- ตาราง ---------- */}
      {rows.length === 0 ? (
        <Card>
          <Empty
            icon={tab === "rent" ? <BikeIcon /> : <Shirt />}
            image={tab === "rent" ? "/illustrations/scooter.svg" : "/illustrations/laundry.svg"}
            title="ไม่พบรายการ"
            hint="ลองเปลี่ยนช่วงวันที่ คำค้น หรือสถานะ"
          />
        </Card>
      ) : (
        <>
          {/* จอใหญ่: ตาราง */}
          <Card className="hidden overflow-hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line bg-surface-2/50 text-left text-xs text-muted">
                    <th className="w-10 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={allChecked}
                        onChange={toggleAll}
                        className="size-4 cursor-pointer accent-[var(--brand)]"
                        aria-label="เลือกทั้งหมด"
                      />
                    </th>
                    {sortHead("date", tab === "rent" ? "วันที่ยืม" : "วันที่")}
                    {tab === "rent" ? (
                      <>
                        {sortHead("name", "ทะเบียน")}
                        <th className="px-3 py-3 font-medium">ลูกค้า</th>
                        <th className="px-3 py-3 font-medium whitespace-nowrap">กำหนดคืน</th>
                        <th className="px-3 py-3 font-medium">สถานะ</th>
                        <th className="px-3 py-3 text-right font-medium">วัน</th>
                        <th className="px-3 py-3 text-right font-medium whitespace-nowrap">ราคา/วัน</th>
                        <th className="px-3 py-3 text-right font-medium whitespace-nowrap">ลด / ปรับ</th>
                        {sortHead("amount", "ยอดรวม", "text-right")}
                      </>
                    ) : (
                      <>
                        {sortHead("name", "ห้อง")}
                        <th className="px-3 py-3 text-right font-medium">กก.</th>
                        {sortHead("amount", "ราคา", "text-right")}
                        <th className="px-3 py-3 font-medium">สถานะ</th>
                        <th className="px-3 py-3 font-medium">หมายเหตุ</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {tab === "rent"
                    ? (shown as Rental[]).map((r) => {
                        const st = rentStatus(r, today, now);
                        return (
                          <tr
                            key={r.id}
                            onClick={() => setEditRental(r)}
                            className={cn(
                              "cursor-pointer border-b border-line last:border-0 hover:bg-surface-2/60",
                              selected.has(r.id) && "bg-brand-soft/40",
                            )}
                          >
                            <td className="px-4 py-2.5">{check(r.id)}</td>
                            <td className="px-3 py-2.5 whitespace-nowrap">
                              {thShort(r.date)} <span className="text-muted">{r.time}</span>
                            </td>
                            <td className="px-3 py-2.5 font-semibold whitespace-nowrap">{r.plate}</td>
                            <td className="max-w-40 truncate px-3 py-2.5 text-ink-2">{r.customer || "-"}</td>
                            <td className="px-3 py-2.5 whitespace-nowrap text-ink-2">
                              {r.dueDate ? `${thShort(r.dueDate)} ${r.dueTime}` : "-"}
                            </td>
                            <td className="px-3 py-2.5">
                              <Badge tone={st.tone}>{st.label}</Badge>
                            </td>
                            <td className="tabular px-3 py-2.5 text-right">{r.days}</td>
                            <td className="tabular px-3 py-2.5 text-right">{baht(r.price)}</td>
                            <td className="tabular px-3 py-2.5 text-right text-xs whitespace-nowrap text-ink-2">
                              {r.discount ? <span className="text-good">-{baht(r.discount)}</span> : ""}
                              {r.discount && r.fine ? " / " : ""}
                              {r.fine ? <span className="text-warn">+{baht(r.fine)}</span> : ""}
                              {!r.discount && !r.fine && "-"}
                            </td>
                            <td className="tabular px-3 py-2.5 text-right font-semibold">{baht(r.total)}</td>
                          </tr>
                        );
                      })
                    : (shown as Laundry[]).map((l) => (
                        <tr
                          key={l.id}
                          onClick={() => setEditLaundry(l)}
                          className={cn(
                            "cursor-pointer border-b border-line last:border-0 hover:bg-surface-2/60",
                            selected.has(l.id) && "bg-brand-soft/40",
                          )}
                        >
                          <td className="px-4 py-2.5">{check(l.id)}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            {thShort(l.date)} <span className="text-muted">{l.time}</span>
                          </td>
                          <td className="px-3 py-2.5 font-semibold">ห้อง {l.room}</td>
                          <td className="tabular px-3 py-2.5 text-right">{number(l.kg, 1)}</td>
                          <td className="tabular px-3 py-2.5 text-right font-semibold">{baht(l.price)}</td>
                          <td className="px-3 py-2.5">
                            {l.paid ? <Badge tone="good">ชำระแล้ว</Badge> : <Badge tone="warn">ค้างชำระ</Badge>}
                          </td>
                          <td className="max-w-56 truncate px-3 py-2.5 text-ink-2">{l.note || "-"}</td>
                        </tr>
                      ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-line bg-surface-2/50 font-semibold">
                    <td />
                    <td className="px-3 py-3" colSpan={tab === "rent" ? 5 : 2}>
                      รวม {number(totals.count)} รายการ
                    </td>
                    {tab === "rent" ? (
                      <>
                        <td className="tabular px-3 py-3 text-right">{totals.qty.replace(" วัน", "")}</td>
                        <td colSpan={2} />
                        <td className="tabular px-3 py-3 text-right text-brand">{baht(totals.sum)}</td>
                      </>
                    ) : (
                      <>
                        <td className="tabular px-3 py-3 text-right">{totals.qty.replace(" กก.", "")}</td>
                        <td className="tabular px-3 py-3 text-right text-laundry">{baht(totals.sum)}</td>
                        <td colSpan={2} />
                      </>
                    )}
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>

          {/* มือถือ: การ์ด */}
          <div className="space-y-2 md:hidden">
            <label className="flex items-center gap-2 px-1 text-sm text-ink-2">
              <input type="checkbox" checked={allChecked} onChange={toggleAll} className="size-4 accent-[var(--brand)]" />
              เลือกทั้งหมด ({number(rows.length)})
            </label>
            {tab === "rent"
              ? (shown as Rental[]).map((r) => {
                  const st = rentStatus(r, today, now);
                  return (
                    <MobileRow
                      key={r.id}
                      selected={selected.has(r.id)}
                      check={check(r.id)}
                      onOpen={() => setEditRental(r)}
                      title={r.plate}
                      sub={[`${thShort(r.date)} ${r.time}`, r.customer, r.dueDate && `คืน ${thShort(r.dueDate)} ${r.dueTime}`]
                        .filter(Boolean)
                        .join(" · ")}
                      amount={baht(r.total)}
                      badge={<Badge tone={st.tone}>{st.label}</Badge>}
                    />
                  );
                })
              : (shown as Laundry[]).map((l) => (
                  <MobileRow
                    key={l.id}
                    selected={selected.has(l.id)}
                    check={check(l.id)}
                    onOpen={() => setEditLaundry(l)}
                    title={`ห้อง ${l.room} · ${number(l.kg, 1)} กก.`}
                    sub={[`${thShort(l.date)} ${l.time}`, l.note].filter(Boolean).join(" · ")}
                    amount={baht(l.price)}
                    badge={l.paid ? <Badge tone="good">ชำระแล้ว</Badge> : <Badge tone="warn">ค้างชำระ</Badge>}
                  />
                ))}
          </div>

          {rows.length > limit && (
            <div className="flex justify-center">
              <Button variant="secondary" onClick={() => setLimit((n) => n + PAGE)}>
                แสดงเพิ่ม ({number(rows.length - limit)} รายการ)
              </Button>
            </div>
          )}
        </>
      )}

      <RentalForm rental={editRental} bikes={bikes} onClose={() => setEditRental(null)} />
      <EditLaundry item={editLaundry} settings={settings} onClose={() => setEditLaundry(null)} />
    </div>
  );
}

function toastResult(res: { ok: boolean; error?: string }, success: string) {
  if (res.ok) toast.success(success);
  else toast.error(res.error ?? "เกิดข้อผิดพลาด");
}

function MobileRow({
  selected,
  check,
  onOpen,
  title,
  sub,
  amount,
  badge,
}: {
  selected: boolean;
  check: ReactNode;
  onOpen: () => void;
  title: string;
  sub: string;
  amount: string;
  badge: ReactNode;
}) {
  return (
    <div
      onClick={onOpen}
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-2xl border bg-surface px-4 py-3 transition",
        selected ? "border-brand bg-brand-soft/40" : "border-line",
      )}
    >
      {check}
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{title}</p>
        <p className="truncate text-xs text-muted">{sub}</p>
      </div>
      <div className="flex flex-col items-end gap-1">
        <span className="tabular text-sm font-semibold">{amount}</span>
        {badge}
      </div>
    </div>
  );
}
