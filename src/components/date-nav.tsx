"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Button, cn } from "@/components/ui";
import { periodLabel, shift, type Period } from "@/lib/dates";

/** เลื่อนวัน/สัปดาห์/เดือน ผ่าน URL (?d=YYYY-MM-DD) */
export function DateNav({ date, period, today }: { date: string; period: Period; today: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();

  const go = (d: string) => {
    const p = new URLSearchParams(params);
    p.set("d", d);
    start(() => router.push(`${pathname}?${p}`, { scroll: false }));
  };

  return (
    <div className={cn("inline-flex w-fit items-center gap-1 rounded-xl border border-line bg-surface p-1", pending && "opacity-70")}>
      <Button variant="ghost" size="icon" onClick={() => go(shift(period, date, -1))} aria-label="ก่อนหน้า">
        <ChevronLeft className="size-4" />
      </Button>
      <label className="relative cursor-pointer px-2 text-sm font-semibold whitespace-nowrap">
        {periodLabel(period, date)}
        <input
          type="date"
          value={date}
          onChange={(e) => e.target.value && go(e.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
          aria-label="เลือกวันที่"
        />
      </label>
      <Button variant="ghost" size="icon" onClick={() => go(shift(period, date, 1))} aria-label="ถัดไป">
        <ChevronRight className="size-4" />
      </Button>
      {date !== today && (
        <Button variant="secondary" size="sm" onClick={() => go(today)} className="ml-1">
          วันนี้
        </Button>
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
