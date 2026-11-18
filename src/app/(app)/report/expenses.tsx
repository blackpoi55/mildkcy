"use client";

import { ArrowDownLeft, ArrowUpRight, Pencil, Trash2, Wallet } from "lucide-react";
import { useState, useSyncExternalStore, useTransition } from "react";
import { toast } from "sonner";
import { deleteExpense, restoreExpense, saveExpense } from "@/app/actions";
import { Button, Card, Field, Input, Segmented, cn } from "@/components/ui";
import { confirmDialog } from "@/lib/confirm";
import { thShort } from "@/lib/dates";
import { baht } from "@/lib/format";
import { useAction } from "@/lib/hooks";
import { isCashIn, type CashKind, type Expense } from "@/lib/schema";

// จำชื่อผู้ทำรายการล่าสุดไว้ ไม่ต้องพิมพ์ซ้ำทุกครั้ง
const BY_KEY = "expense-by";
const blank = { id: "", kind: "เบิก" as CashKind, item: "", amount: "", note: "" };
const subscribeNoop = () => () => {};
function savedBy() {
  try {
    return localStorage.getItem(BY_KEY) ?? "";
  } catch {
    return "";
  }
}

const TEXT = {
  รับ: { item: "รับเงินอะไร", placeholder: "เช่น เงินทอนจากหัวหน้า, ค่ามัดจำ", by: "ผู้รับเงิน", save: "บันทึกรับเงิน" },
  เบิก: { item: "เบิกไปทำอะไร", placeholder: "เช่น ซื้อน้ำมัน, ค่าน้ำแข็ง", by: "ผู้เบิก", save: "บันทึกเบิก" },
} satisfies Record<CashKind, Record<string, string>>;

/** จดเงินรับเข้า / เบิกออกของวันนั้น (แสดงเฉพาะบนจอ ไม่ออกในใบพิมพ์) */
export function ExpensePanel({ date, items }: { date: string; items: Expense[] }) {
  const { pending, run } = useAction();
  const [, start] = useTransition();
  const [form, setForm] = useState(blank);
  const set = (k: "item" | "amount" | "note") => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  // null = ยังไม่ได้พิมพ์ → ใช้ชื่อที่จำไว้
  const [typedBy, setTypedBy] = useState<string | null>(null);
  const remembered = useSyncExternalStore(subscribeNoop, savedBy, () => "");
  const by = typedBy ?? remembered;
  const received = items.filter(isCashIn).reduce((s, e) => s + e.amount, 0);
  const spent = items.filter((e) => !isCashIn(e)).reduce((s, e) => s + e.amount, 0);
  const t = TEXT[form.kind];
  // เปลี่ยนประเภทแล้วยังจำว่ากำลังรับหรือเบิกอยู่ (จดหลายรายการประเภทเดียวกันติดกัน)
  const reset = () => {
    setForm((f) => ({ ...blank, kind: f.kind }));
    setTypedBy(null);
  };

  const editing = items.find((e) => e.id === form.id);
  const submit = () =>
    run(
      () =>
        saveExpense({ ...editing, date, kind: form.kind, item: form.item, amount: Number(form.amount), by, note: form.note }),
      editing ? "แก้ไขรายการแล้ว" : `บันทึก${form.kind === "รับ" ? "รับเงิน" : "เบิก"} ${form.item} · ${baht(Number(form.amount))}`,
      () => {
        try {
          if (by) localStorage.setItem(BY_KEY, by);
        } catch {}
        reset();
      },
    );

  const remove = async (e: Expense) => {
    const ok = await confirmDialog({
      title: isCashIn(e) ? "ลบรายการรับเงินนี้?" : "ลบรายการเบิกนี้?",
      html: `${e.item} · ${baht(e.amount)}`,
      confirmText: "ลบ",
      danger: true,
    });
    if (!ok) return;
    start(async () => {
      const res = await deleteExpense(e.id);
      if (!res.ok) return void toast.error(res.error);
      if (form.id === e.id) reset();
      toast.success("ลบรายการแล้ว", {
        duration: 10_000,
        action: {
          label: "เลิกทำ",
          onClick: () =>
            start(async () => {
              const r = await restoreExpense(e);
              if (r.ok) toast.success("คืนรายการแล้ว");
              else toast.error(r.error);
            }),
        },
      });
    });
  };

  return (
    <Card className="mb-6 p-5 print:hidden">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-semibold">
          <span className="grid size-8 place-items-center rounded-lg bg-warn-soft text-warn">
            <Wallet className="size-4" />
          </span>
          รับเงิน / เบิกเงิน · {thShort(date)}
        </h3>
        <p className="text-sm text-muted">
          รับ <b className="tabular text-good">+{baht(received)}</b> · เบิก <b className="tabular text-bad">-{baht(spent)}</b>{" "}
          · คิดรวมในยอดที่นำส่งหัวหน้า
        </p>
      </div>

      <form
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[auto_2fr_1fr_1fr_2fr_auto] lg:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div>
          <span className="mb-1.5 block text-xs font-medium text-ink-2">ประเภท</span>
          <Segmented
            value={form.kind}
            onChange={(kind) => setForm((f) => ({ ...f, kind }))}
            className="w-full"
            options={[
              { value: "รับ", label: <span className="flex items-center gap-1"><ArrowDownLeft className="size-4 text-good" />รับเงิน</span> },
              { value: "เบิก", label: <span className="flex items-center gap-1"><ArrowUpRight className="size-4 text-bad" />เบิกเงิน</span> },
            ]}
          />
        </div>
        <Field label={t.item}>
          <Input value={form.item} onChange={set("item")} placeholder={t.placeholder} required />
        </Field>
        <Field label="จำนวนเงิน (บาท)">
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            value={form.amount}
            onChange={set("amount")}
            placeholder="0"
            required
          />
        </Field>
        <Field label={t.by}>
          <Input value={by} onChange={(e) => setTypedBy(e.target.value)} placeholder="ชื่อ" />
        </Field>
        <Field label="หมายเหตุ">
          <Input value={form.note} onChange={set("note")} placeholder="ไม่บังคับ" />
        </Field>
        <div className="flex gap-2">
          {editing && (
            <Button type="button" variant="secondary" onClick={reset}>
              ยกเลิก
            </Button>
          )}
          <Button type="submit" disabled={pending} className="flex-1 whitespace-nowrap">
            {editing ? "บันทึกการแก้ไข" : t.save}
          </Button>
        </div>
      </form>

      {items.length > 0 && (
        <ul className="mt-4 divide-y divide-line border-t border-line">
          {items.map((e) => {
            const cashIn = isCashIn(e);
            return (
              <li key={e.id} className={cn("flex items-center gap-3 py-2.5", form.id === e.id && "bg-brand-soft/60")}>
                <span className="tabular w-12 shrink-0 text-xs text-muted">{e.time}</span>
                <span
                  className={cn(
                    "grid size-7 shrink-0 place-items-center rounded-lg",
                    cashIn ? "bg-good-soft text-good" : "bg-bad-soft text-bad",
                  )}
                  title={cashIn ? "รับเงิน" : "เบิกเงิน"}
                >
                  {cashIn ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{e.item}</p>
                  <p className="truncate text-xs text-muted">
                    {[e.by && `${cashIn ? "ผู้รับ" : "ผู้เบิก"} ${e.by}`, e.note].filter(Boolean).join(" · ") || "-"}
                  </p>
                </div>
                <span className={cn("tabular text-sm font-semibold", cashIn ? "text-good" : "text-bad")}>
                  {cashIn ? "+" : "-"}
                  {baht(e.amount)}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="แก้ไข"
                  onClick={() => {
                    setForm({ id: e.id, kind: cashIn ? "รับ" : "เบิก", item: e.item, amount: String(e.amount), note: e.note });
                    setTypedBy(e.by);
                  }}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button variant="ghost" size="icon" aria-label="ลบ" onClick={() => remove(e)}>
                  <Trash2 className="size-4" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
