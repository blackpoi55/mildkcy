import { AlarmClock, ArrowRight, CalendarClock, User } from "lucide-react";
import Link from "next/link";
import clsx from "clsx";
import { Badge } from "@/components/ui";
import { durationText, dueText, type DueItem } from "@/lib/rental-status";
import type { Bike } from "@/lib/schema";

/** แถบ "ใกล้ถึงเวลาคืน": เลยกำหนด (แดง) / อีกไม่เกิน 3 ชม. (เหลือง) / ภายใน 24 ชม. */
export function DueSoon({
  items,
  bikes,
  today,
  showCustomer,
  href,
}: {
  items: DueItem[];
  bikes: Bike[];
  today: string;
  showCustomer: boolean;
  href?: string;
}) {
  if (!items.length) return null;
  const bikeById = new Map(bikes.map((b) => [b.id, b]));
  const late = items.filter((x) => x.left < 0).length;
  const soon = items.filter((x) => x.left >= 0 && x.left <= 180).length;

  return (
    <section
      className={clsx(
        "mb-6 overflow-hidden rounded-2xl border bg-surface",
        late ? "border-bad/40" : soon ? "border-warn/40" : "border-line",
      )}
    >
      <div
        className={clsx(
          "flex flex-wrap items-center justify-between gap-2 px-5 py-3",
          late ? "bg-bad-soft" : soon ? "bg-warn-soft" : "bg-surface-2/60",
        )}
      >
        <h2 className={clsx("flex items-center gap-2 font-semibold", late ? "text-bad" : soon ? "text-warn" : "text-ink")}>
          <AlarmClock className="size-5" />
          ใกล้ถึงเวลาคืนรถ
        </h2>
        <p className="text-sm text-ink-2">
          {late > 0 && <b className="text-bad">เลยกำหนด {late} คัน · </b>}
          {soon > 0 && <b className="text-warn">ภายใน 3 ชม. {soon} คัน · </b>}
          ทั้งหมด {items.length} คัน ใน 24 ชม.
        </p>
      </div>
      <ul className="grid sm:grid-cols-2 xl:grid-cols-3">
        {items.map(({ rental: r, left }) => {
          const b = bikeById.get(r.bikeId);
          const tone = left < 0 ? "bad" : left <= 180 ? "warn" : "neutral";
          return (
            <li key={r.id} className="flex items-center gap-3 border-t border-line px-5 py-3">
              <span
                className={clsx(
                  "grid size-10 shrink-0 place-items-center rounded-xl",
                  tone === "bad" ? "bg-bad text-white" : tone === "warn" ? "bg-warn-soft text-warn" : "bg-surface-2 text-ink-2",
                )}
              >
                {tone === "neutral" ? <CalendarClock className="size-5" /> : <AlarmClock className="size-5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {r.plate} <span className="text-xs font-normal text-muted">{b ? `${b.brand} ${b.model}` : ""}</span>
                </p>
                <p className="truncate text-xs text-muted">
                  คืน {dueText(r.dueDate, r.dueTime, today)}
                  {showCustomer && r.customer && (
                    <span className="ml-1 inline-flex items-center gap-0.5">
                      · <User className="size-3" /> {r.customer}
                    </span>
                  )}
                </p>
              </div>
              <Badge tone={tone}>{left < 0 ? `เลยมา ${durationText(-left)}` : `อีก ${durationText(left)}`}</Badge>
            </li>
          );
        })}
      </ul>
      {href && (
        <Link
          href={href}
          className="flex items-center justify-between border-t border-line px-5 py-2.5 text-sm font-medium text-brand hover:bg-surface-2/60"
        >
          ไปแท็บคืนรถ
          <ArrowRight className="size-4" />
        </Link>
      )}
    </section>
  );
}
