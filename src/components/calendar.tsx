"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { cn } from "@/components/ui";
import {
  TH_DAYS_SHORT,
  TH_MONTHS,
  TH_MONTHS_SHORT,
  addDays,
  addMonths,
  startOfMonth,
  startOfWeek,
  thLong,
  type Period,
} from "@/lib/dates";

/**
 * ปฏิทินภาษาไทย (ปี พ.ศ.)
 * - mode "day": เลือกวัน
 * - mode "week": เลือกวันไหนก็ได้ ไฮไลต์ทั้งสัปดาห์ (อา.–ส.)
 * - mode "month": เลือกเดือน
 */
export function Calendar({
  value,
  today,
  mode,
  onSelect,
}: {
  value: string;
  today: string;
  mode: Period;
  onSelect: (iso: string) => void;
}) {
  const [view, setView] = useState(startOfMonth(value));
  const [layer, setLayer] = useState<"days" | "months">(mode === "month" ? "months" : "days");
  const year = Number(view.slice(0, 4));
  const month = Number(view.slice(5, 7));

  const navBtn =
    "grid size-8 cursor-pointer place-items-center rounded-lg text-ink-2 transition hover:bg-surface-2 hover:text-ink";

  if (layer === "months") {
    const selMonth = value.slice(0, 7);
    return (
      <div>
        <div className="mb-3 flex items-center justify-between">
          <button className={navBtn} onClick={() => setView(addMonths(view, -12))} aria-label="ปีก่อนหน้า">
            <ChevronLeft className="size-4" />
          </button>
          <span className="text-sm font-semibold">พ.ศ. {year + 543}</span>
          <button className={navBtn} onClick={() => setView(addMonths(view, 12))} aria-label="ปีถัดไป">
            <ChevronRight className="size-4" />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {TH_MONTHS_SHORT.map((m, i) => {
            const iso = `${year}-${String(i + 1).padStart(2, "0")}-01`;
            const selected = iso.slice(0, 7) === selMonth;
            const isNow = iso.slice(0, 7) === today.slice(0, 7);
            return (
              <button
                key={m}
                onClick={() => {
                  if (mode === "month") onSelect(iso);
                  else {
                    setView(iso);
                    setLayer("days");
                  }
                }}
                aria-label={`${TH_MONTHS[i]} ${year + 543}`}
                className={cn(
                  "h-11 cursor-pointer rounded-xl text-sm font-medium transition",
                  selected
                    ? "bg-brand-2 text-white shadow-sm"
                    : isNow
                      ? "text-brand ring-1 ring-brand/40 ring-inset hover:bg-brand-soft"
                      : "text-ink hover:bg-surface-2",
                )}
              >
                {m}
              </button>
            );
          })}
        </div>
        <Footer today={today} mode={mode} onSelect={onSelect} />
      </div>
    );
  }

  const first = startOfWeek(view);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(first, i));
  const weekStart = startOfWeek(value);
  const weekEnd = addDays(weekStart, 6);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <button className={navBtn} onClick={() => setView(addMonths(view, -1))} aria-label="เดือนก่อนหน้า">
          <ChevronLeft className="size-4" />
        </button>
        <button
          className="cursor-pointer rounded-lg px-2 py-1 text-sm font-semibold hover:bg-surface-2"
          onClick={() => setLayer("months")}
          title="เลือกเดือน / ปี"
        >
          {TH_MONTHS[month - 1]} {year + 543}
        </button>
        <button className={navBtn} onClick={() => setView(addMonths(view, 1))} aria-label="เดือนถัดไป">
          <ChevronRight className="size-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 text-center text-[11px] font-medium text-muted">
        {TH_DAYS_SHORT.map((d) => (
          <span key={d} className="py-1.5">
            {d}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((d) => {
          const inMonth = Number(d.slice(5, 7)) === month;
          const selected = mode === "day" ? d === value : false;
          const inWeek = mode === "week" && d >= weekStart && d <= weekEnd;
          const isToday = d === today;
          return (
            <button
              key={d}
              onClick={() => onSelect(d)}
              aria-label={thLong(d)}
              aria-pressed={selected || inWeek}
              className={cn(
                "relative mx-auto grid size-9 cursor-pointer place-items-center text-sm transition",
                inWeek
                  ? cn(
                      "w-full bg-brand-soft font-semibold text-brand-ink",
                      d === weekStart && "rounded-l-xl",
                      d === weekEnd && "rounded-r-xl",
                    )
                  : "rounded-xl",
                selected && "bg-brand-2 font-semibold text-white shadow-sm",
                !selected && !inWeek && (inMonth ? "text-ink hover:bg-surface-2" : "text-muted/60 hover:bg-surface-2"),
              )}
            >
              {Number(d.slice(8))}
              {isToday && (
                <span
                  className={cn(
                    "absolute bottom-1 size-1 rounded-full",
                    selected ? "bg-white" : "bg-brand",
                  )}
                />
              )}
            </button>
          );
        })}
      </div>
      <Footer today={today} mode={mode} onSelect={onSelect} />
    </div>
  );
}

function Footer({ today, mode, onSelect }: { today: string; mode: Period; onSelect: (iso: string) => void }) {
  const quick =
    mode === "day"
      ? [
          { label: "วันนี้", iso: today },
          { label: "เมื่อวาน", iso: addDays(today, -1) },
          { label: "7 วันก่อน", iso: addDays(today, -7) },
        ]
      : mode === "week"
        ? [
            { label: "สัปดาห์นี้", iso: today },
            { label: "สัปดาห์ก่อน", iso: addDays(today, -7) },
          ]
        : [
            { label: "เดือนนี้", iso: startOfMonth(today) },
            { label: "เดือนก่อน", iso: addMonths(startOfMonth(today), -1) },
          ];
  return (
    <div className="mt-3 flex flex-wrap gap-1.5 border-t border-line pt-3">
      {quick.map((q) => (
        <button
          key={q.label}
          onClick={() => onSelect(q.iso)}
          className="cursor-pointer rounded-lg border border-line px-2.5 py-1 text-xs font-medium text-ink-2 transition hover:border-brand hover:text-brand"
        >
          {q.label}
        </button>
      ))}
    </div>
  );
}
