import { AlarmClock, ArrowRight, Bike, CheckCircle2, Clock, Shirt, User } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Badge, Card } from "@/components/ui";
import { nowTime } from "@/lib/dates";
import { baht, number } from "@/lib/format";
import { durationText, dueText, overdueMinutes, returnedText } from "@/lib/rental-status";
import type { Bike as BikeRow, Laundry, Rental } from "@/lib/schema";
import { LiveBadge } from "./live";

function Panel({
  icon,
  tint,
  title,
  big,
  sub,
  href,
  hrefLabel,
  children,
}: {
  icon: ReactNode;
  tint: string;
  title: string;
  big: string;
  sub: ReactNode;
  href?: string;
  hrefLabel?: string;
  children: ReactNode;
}) {
  return (
    <Card className="flex flex-col">
      <div className="flex items-start gap-3 px-5 pt-5">
        <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${tint}`}>{icon}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink-2">{title}</p>
          <p className="tabular text-2xl leading-tight font-bold">{big}</p>
          <div className="text-xs text-muted">{sub}</div>
        </div>
      </div>
      <div className="flex-1 px-5 py-4">{children}</div>
      {href && (
        <Link
          href={href}
          className="flex items-center justify-between border-t border-line px-5 py-3 text-sm font-medium text-brand hover:bg-surface-2/60"
        >
          {hrefLabel}
          <ArrowRight className="size-4" />
        </Link>
      )}
    </Card>
  );
}

/** สรุป "วันนี้" แบบอ่านง่าย: รถที่ออกเช่า / รถว่าง / ซักผ้า */
export function TodayPanel({
  today,
  dateLabel,
  updatedAt,
  stale,
  bikes,
  rentals,
  laundry,
  rentableCount,
  canEdit,
}: {
  today: string;
  dateLabel: string;
  updatedAt: string;
  stale?: boolean;
  bikes: BikeRow[];
  rentals: Rental[];
  laundry: Laundry[];
  rentableCount: number;
  canEdit: boolean;
}) {
  const bikeById = new Map(bikes.map((b) => [b.id, b]));
  const now = nowTime();
  const rentedToday = rentals.filter((r) => r.days > 0);
  // กำลังเช่าอยู่ = ยังไม่คืน (เรียง: เลยกำหนดก่อน แล้วตามเวลาคืน)
  const out = rentedToday
    .filter((r) => !r.returnTime)
    .sort(
      (a, b) =>
        overdueMinutes(b, today, now) - overdueMinutes(a, today, now) ||
        `${a.dueDate || "9"} ${a.dueTime}`.localeCompare(`${b.dueDate || "9"} ${b.dueTime}`) ||
        (a.time || "99").localeCompare(b.time || "99"),
    );
  const returned = rentedToday.filter((r) => r.returnTime);
  const lateCount = out.filter((r) => overdueMinutes(r, today, now) > 0).length;
  const outIds = new Set(out.map((r) => r.bikeId));
  const returnedAt = new Map(returned.map((r) => [r.bikeId, returnedText(r)]));
  const free = bikes.filter((b) => b.status === "เช่า" && !outIds.has(b.id));
  // รายได้นับที่วันเริ่มเช่า (รายการที่เริ่มก่อนวันนี้แสดงสถานะอย่างเดียว)
  const rentTotal = rentals.filter((r) => r.date === today).reduce((s, r) => s + r.total, 0);
  const wash = [...laundry].sort((a, b) => (a.time || "").localeCompare(b.time || ""));
  const washTotal = wash.reduce((s, l) => s + l.price, 0);
  const washKg = wash.reduce((s, l) => s + l.kg, 0);
  const unpaid = wash.filter((l) => !l.paid).reduce((s, l) => s + l.price, 0);

  return (
    <section className="mb-10">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">วันนี้</h2>
          <p className="text-sm text-muted">
            {dateLabel} · รายได้รวม <b className="tabular text-ink">{baht(rentTotal + washTotal)}</b>
          </p>
        </div>
        <LiveBadge updatedAt={updatedAt} stale={stale} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel
          icon={<Bike className="size-5" />}
          tint="bg-rent/15 text-rent"
          title="กำลังเช่าอยู่"
          big={`${out.length} / ${rentableCount} คัน`}
          sub={
            <>
              เช่าใหม่วันนี้ {rentedToday.filter((r) => r.date === today).length} ครั้ง · คืนแล้ว {returned.length} · รายได้ {baht(rentTotal)}
              {lateCount > 0 && <span className="font-semibold text-bad"> · เลยกำหนด {lateCount} คัน</span>}
            </>
          }
          href={canEdit ? `/rentals?d=${today}` : undefined}
          hrefLabel="บันทึกเช่ารถวันนี้"
        >
          {out.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted">
              {rentedToday.length ? "คืนรถครบทุกคันแล้ว" : "ยังไม่มีรถออกเช่าวันนี้"}
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {out.map((r) => {
                const b = bikeById.get(r.bikeId);
                const late = overdueMinutes(r, today, now);
                return (
                  <li key={r.id} className="flex items-center gap-3 py-2.5">
                    <span className="flex w-14 shrink-0 items-center gap-1 text-xs font-medium text-ink-2">
                      <Clock className="size-3 text-muted" />
                      {r.time || "--:--"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{r.plate}</p>
                      <p className="truncate text-xs text-muted">
                        {b ? `${b.brand} ${b.model}` : ""}
                        {canEdit && r.customer && (
                          <span className="ml-1 inline-flex items-center gap-0.5">
                            · <User className="size-3" /> {r.customer}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-0.5">
                      <span className="tabular text-sm font-semibold">{baht(r.total)}</span>
                      {late > 0 ? (
                        <Badge tone="bad">
                          <AlarmClock className="size-3" /> เลยกำหนด {durationText(late)}
                        </Badge>
                      ) : (
                        r.dueDate && (
                          <span className="text-[11px] text-muted">คืน {dueText(r.dueDate, r.dueTime, today)}</span>
                        )
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel
          icon={<CheckCircle2 className="size-5" />}
          tint="bg-good-soft text-good"
          title="รถว่าง พร้อมให้เช่า"
          big={`${free.length} คัน`}
          sub={free.length ? "พร้อมให้ลูกค้าเช่าได้ทันที" : "รถออกครบทุกคันแล้ว 🎉"}
          href={canEdit ? `/rentals?d=${today}` : undefined}
          hrefLabel="ไปหน้าบันทึกเช่า"
        >
          {free.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted">ไม่มีรถว่าง</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {free.map((b) => (
                <span
                  key={b.id}
                  className="rounded-xl border border-line bg-surface-2/60 px-2.5 py-1.5 text-xs leading-tight"
                  title={`${b.brand} ${b.model}`}
                >
                  <span className="block font-semibold text-ink">
                    {b.plate}
                    {returnedAt.get(b.id) && (
                      <span className="ml-1 font-normal text-good">· คืน {returnedAt.get(b.id)}</span>
                    )}
                  </span>
                  <span className="text-muted">
                    {b.model} · {baht(b.dailyRate)}
                  </span>
                </span>
              ))}
            </div>
          )}
        </Panel>

        <Panel
          icon={<Shirt className="size-5" />}
          tint="bg-laundry/15 text-laundry"
          title="ซักผ้า"
          big={`${wash.length} รายการ`}
          sub={
            <>
              {number(washKg, 1)} กก. · {baht(washTotal)}
              {unpaid > 0 && <span className="text-warn"> · ค้างชำระ {baht(unpaid)}</span>}
            </>
          }
          href={canEdit ? `/laundry?d=${today}` : undefined}
          hrefLabel="บันทึกซักผ้า"
        >
          {wash.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted">ยังไม่มีรายการซักผ้าวันนี้</p>
          ) : (
            <ul className="divide-y divide-line">
              {wash.map((l) => (
                <li key={l.id} className="flex items-center gap-3 py-2.5">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-laundry/15 text-sm font-bold text-laundry">
                    {l.room}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">
                      ห้อง {l.room} · {number(l.kg, 1)} กก.
                    </p>
                    <p className="text-xs text-muted">{l.time}</p>
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="tabular text-sm font-semibold">{baht(l.price)}</span>
                    {l.paid ? <Badge tone="good">ชำระแล้ว</Badge> : <Badge tone="warn">ค้างชำระ</Badge>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </section>
  );
}
