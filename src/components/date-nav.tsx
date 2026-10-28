"use client";

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import { Calendar } from "@/components/calendar";
import { Button, cn } from "@/components/ui";
import { periodLabel, shift, type Period } from "@/lib/dates";

const PANEL_W = 312;

/** เลื่อนวัน/สัปดาห์/เดือน ผ่าน URL (?d=YYYY-MM-DD) + กดที่วันที่เพื่อเปิดปฏิทิน */
export function DateNav({ date, period, today }: { date: string; period: Period; today: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  const go = (d: string) => {
    setOpen(false);
    const p = new URLSearchParams(params);
    p.set("d", d);
    start(() => router.push(`${pathname}?${p}`, { scroll: false }));
  };

  // วางปฏิทินใต้ปุ่ม และไม่ให้ล้นขอบจอ (ถ้าด้านล่างไม่พอ เปิดขึ้นด้านบน)
  const place = useCallback(() => {
    const r = trigger.current?.getBoundingClientRect();
    if (!r) return;
    const h = panel.current?.offsetHeight ?? 380;
    const left = Math.min(Math.max(8, r.left + r.width / 2 - PANEL_W / 2), window.innerWidth - PANEL_W - 8);
    const below = r.bottom + 8;
    const top = below + h > window.innerHeight - 8 && r.top - h - 8 > 8 ? r.top - h - 8 : below;
    setPos({ top, left });
  }, []);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!panel.current?.contains(t) && !trigger.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, place]);

  return (
    <div className={cn("inline-flex w-fit items-center gap-1 rounded-xl border border-line bg-surface p-1", pending && "opacity-70")}>
      <Button variant="ghost" size="icon" onClick={() => go(shift(period, date, -1))} aria-label="ก่อนหน้า">
        <ChevronLeft className="size-4" />
      </Button>
      <button
        ref={trigger}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          "flex h-9 cursor-pointer items-center gap-2 rounded-lg px-2.5 text-sm font-semibold whitespace-nowrap transition hover:bg-surface-2",
          open && "bg-surface-2",
        )}
      >
        <CalendarDays className="size-4 text-brand" />
        {periodLabel(period, date)}
      </button>
      <Button variant="ghost" size="icon" onClick={() => go(shift(period, date, 1))} aria-label="ถัดไป">
        <ChevronRight className="size-4" />
      </Button>
      {date !== today && (
        <Button variant="secondary" size="sm" onClick={() => go(today)} className="ml-1">
          วันนี้
        </Button>
      )}

      {open && (
        <div
          ref={panel}
          role="dialog"
          aria-label="เลือกวันที่"
          style={{ top: pos?.top ?? -9999, left: pos?.left ?? 0, width: PANEL_W }}
          className="animate-pop fixed z-50 rounded-2xl border border-line bg-surface p-4 shadow-2xl shadow-black/20"
        >
          <Calendar value={date} today={today} mode={period} onSelect={go} />
        </div>
      )}
    </div>
  );
}

export function useSetParam() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (key: string, value: string) => {
    const p = new URLSearchParams(params);
    p.set(key, value);
    router.push(`${pathname}?${p}`, { scroll: false });
  };
}
