"use client";

import { AlertTriangle, CheckCircle2, Database, ExternalLink, FileSpreadsheet, FlaskConical, Plus, RefreshCw, Shirt, Upload, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { importSeed, saveSettings } from "@/app/actions";
import { Badge, Button, Card, CardHeader, Field, Input } from "@/components/ui";
import { buildPriceTable, type AppSettings, type LaundryPrice } from "@/lib/laundry";
import { number } from "@/lib/format";
import { useAction } from "@/lib/hooks";

export function SettingsClient({
  settings,
  mode,
  configured,
  sheetUrl,
  serviceEmail,
  counts,
  hasSeed,
  error,
}: {
  settings: AppSettings;
  mode: "sheets" | "local";
  configured: boolean;
  sheetUrl: string;
  serviceEmail: string;
  counts: { bikes: number; rentals: number };
  hasSeed: boolean;
  error: string;
}) {
  return (
    <div className="grid items-start gap-6 xl:grid-cols-2">
      <div className="space-y-6">
        <Connection
          mode={mode}
          configured={configured}
          sheetUrl={sheetUrl}
          serviceEmail={serviceEmail}
          counts={counts}
          hasSeed={hasSeed}
          error={error}
        />
        <Rooms initial={settings.rooms} />
      </div>
      <Prices settings={settings} />
    </div>
  );
}

function Connection({
  mode,
  configured,
  sheetUrl,
  serviceEmail,
  counts,
  hasSeed,
  error,
}: {
  mode: "sheets" | "local";
  configured: boolean;
  sheetUrl: string;
  serviceEmail: string;
  counts: { bikes: number; rentals: number };
  hasSeed: boolean;
  error: string;
}) {
  const { pending, run } = useAction();
  return (
    <Card className="overflow-hidden">
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <Database className="size-4 text-brand" /> ฐานข้อมูล
          </span>
        }
        action={
          error ? (
            <Badge tone="bad">
              <AlertTriangle className="size-3" /> เชื่อมต่อไม่ได้
            </Badge>
          ) : mode === "sheets" ? (
            <Badge tone="good">
              <CheckCircle2 className="size-3" /> Google Sheets
            </Badge>
          ) : (
            <Badge tone="warn">
              <FlaskConical className="size-3" /> โหมดทดลอง
            </Badge>
          )
        }
      />
      <div className="space-y-4 p-5">
        {error && (
          <div className="rounded-xl bg-bad-soft p-4 text-sm text-bad">
            <p className="font-semibold">เชื่อมต่อ Google Sheets ไม่สำเร็จ</p>
            <p className="mt-1 break-words opacity-90">{error}</p>
            <p className="mt-2 opacity-90">ตรวจว่าแชร์ชีตให้อีเมล service account เป็น “ผู้แก้ไข” แล้ว และค่าใน .env.local ถูกต้อง</p>
          </div>
        )}
        {configured ? (
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-3 rounded-xl bg-surface-2 p-3">
              <FileSpreadsheet className="size-8 shrink-0 text-good" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">บันทึกลง Google Sheet</p>
                <p className="truncate text-xs text-muted">{serviceEmail}</p>
              </div>
              <a href={sheetUrl} target="_blank" rel="noreferrer">
                <Button variant="secondary" size="sm">
                  เปิดชีต <ExternalLink className="size-3.5" />
                </Button>
              </a>
            </div>
            <p className="text-muted">
              ระบบสร้างแท็บ <b>รถ</b>, <b>เช่ารถ</b>, <b>ซักผ้า</b>, <b>ตั้งค่า</b> ให้อัตโนมัติ แก้ไขในชีตได้โดยตรง (อย่าลบคอลัมน์ id)
            </p>
          </div>
        ) : (
          <div className="space-y-2 text-sm text-ink-2">
            <p>ตอนนี้ข้อมูลถูกเก็บในไฟล์ <code className="rounded bg-surface-2 px-1">.data/db.json</code> ในเครื่อง หากต้องการใช้ Google Sheets:</p>
            <ol className="list-decimal space-y-1 pl-5 text-muted">
              <li>สร้าง Service Account ใน Google Cloud และเปิดใช้ Google Sheets API</li>
              <li>สร้าง Google Sheet ใหม่ แล้วกดแชร์ให้อีเมลของ Service Account (สิทธิ์ผู้แก้ไข)</li>
              <li>
                ใส่ค่า <code>GOOGLE_SHEET_ID</code>, <code>GOOGLE_SERVICE_ACCOUNT_EMAIL</code>, <code>GOOGLE_PRIVATE_KEY</code> ใน{" "}
                <code>.env.local</code> แล้วรีสตาร์ต
              </li>
            </ol>
            <p className="text-muted">ดูขั้นตอนละเอียดในไฟล์ README.md</p>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-line p-4">
          <div className="text-sm">
            <p className="font-medium">นำเข้าข้อมูลจาก Excel ต้นฉบับ</p>
            <p className="text-muted">
              ตอนนี้มีรถ {number(counts.bikes)} คัน · บันทึกเช่า {number(counts.rentals)} รายการ
            </p>
          </div>
          <Button
            variant="secondary"
            disabled={!hasSeed || pending}
            onClick={() =>
              run(importSeed, undefined, (d) => {
                if (d) toast.success(`นำเข้าแล้ว: รถ ${d.bikes} คัน, บันทึกเช่า ${d.rentals} รายการ (ข้ามรายการที่ซ้ำ)`);
              })
            }
          >
            <Upload className="size-4" /> {pending ? "กำลังนำเข้า…" : hasSeed ? "นำเข้า" : "ไม่พบ data/seed.json"}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function Rooms({ initial }: { initial: string[] }) {
  const { pending, run } = useAction();
  const [rooms, setRooms] = useState(initial);
  const [draft, setDraft] = useState("");
  const add = () => {
    const r = draft.trim();
    if (r && !rooms.includes(r)) setRooms([...rooms, r]);
    setDraft("");
  };
  return (
    <Card>
      <CardHeader title="รายการห้อง (ซักผ้า)" subtitle="ค่าเริ่มต้น ห้อง 1–16 ไม่มีห้อง 13" />
      <div className="p-5">
        <div className="mb-4 flex flex-wrap gap-2">
          {rooms.map((r) => (
            <span key={r} className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface-2 py-1 pr-1 pl-3 text-sm font-medium">
              {r}
              <button
                onClick={() => setRooms(rooms.filter((x) => x !== r))}
                className="grid size-6 cursor-pointer place-items-center rounded-md text-muted hover:bg-bad-soft hover:text-bad"
                aria-label={`ลบห้อง ${r}`}
              >
                <X className="size-3.5" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <Input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="เพิ่มห้อง เช่น 17" />
          <Button variant="secondary" onClick={add} aria-label="เพิ่มห้อง">
            <Plus className="size-4" />
          </Button>
          <Button disabled={pending} onClick={() => run(() => saveSettings({ rooms }), "บันทึกรายการห้องแล้ว")}>
            บันทึก
          </Button>
        </div>
      </div>
    </Card>
  );
}

function Prices({ settings }: { settings: AppSettings }) {
  const { pending, run } = useAction();
  const [rate, setRate] = useState(settings.laundryRate);
  const [prices, setPrices] = useState<LaundryPrice[]>(settings.laundryPrices);
  const setPrice = (i: number, k: keyof LaundryPrice, v: number) =>
    setPrices(prices.map((p, j) => (j === i ? { ...p, [k]: v } : p)));

  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <Shirt className="size-4 text-laundry" /> ราคาซักผ้า
          </span>
        }
        subtitle="กำหนดราคาตามน้ำหนัก ทั้งกิโลเต็มและครึ่งกิโล — น้ำหนักที่ไม่มีในตารางจะคิดตามราคาต่อ กก."
      />
      <div className="space-y-4 p-5">
        <div className="flex items-end gap-2">
          <Field label="ราคาต่อ กก. (บาท)" className="flex-1">
            <Input type="number" inputMode="decimal" value={rate} onChange={(e) => setRate(Number(e.target.value))} />
          </Field>
          <Button variant="secondary" onClick={() => setPrices(buildPriceTable(rate))}>
            <RefreshCw className="size-4" /> สร้างตารางจากราคานี้
          </Button>
        </div>

        <div className="max-h-[440px] overflow-y-auto rounded-xl border border-line">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface-2 text-xs text-muted">
              <tr>
                <th className="px-4 py-2 text-left font-medium">น้ำหนัก (กก.)</th>
                <th className="px-4 py-2 text-left font-medium">ราคา (บาท)</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {prices.map((p, i) => (
                <tr key={i} className="border-t border-line">
                  <td className="px-3 py-1.5">
                    <Input type="number" step="0.5" value={p.kg} onChange={(e) => setPrice(i, "kg", Number(e.target.value))} className="h-9" />
                  </td>
                  <td className="px-3 py-1.5">
                    <Input type="number" value={p.price} onChange={(e) => setPrice(i, "price", Number(e.target.value))} className="h-9" />
                  </td>
                  <td className="pr-2">
                    <Button variant="ghost" size="icon" onClick={() => setPrices(prices.filter((_, j) => j !== i))} aria-label="ลบแถว">
                      <X className="size-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-between gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              const last = prices.at(-1);
              const kg = (last?.kg ?? 0) + 0.5;
              setPrices([...prices, { kg, price: Math.round(kg * rate) }]);
            }}
          >
            <Plus className="size-4" /> เพิ่มแถว
          </Button>
          <Button
            disabled={pending}
            onClick={() => run(() => saveSettings({ laundryRate: rate, laundryPrices: prices }), "บันทึกราคาแล้ว")}
          >
            บันทึกราคา
          </Button>
        </div>
      </div>
    </Card>
  );
}
