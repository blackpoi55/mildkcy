"use client";

import { Bar, BarChart, Cell, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts";
import { thShort } from "@/lib/dates";
import { baht, compactBaht, number } from "@/lib/format";
import type { DayPoint, MonthPoint } from "@/lib/analytics";

// รายได้ 2 ชุด: เช่ารถ (ฟ้า) / ซักผ้า (ส้ม) — สีจาก CSS variable รองรับโหมดมืด
const SERIES = [
  { key: "rent", label: "เช่ารถ", color: "var(--series-rent)" },
  { key: "laundry", label: "ซักผ้า", color: "var(--series-laundry)" },
] as const;

export function Legend() {
  return (
    <div className="flex items-center gap-4 text-xs text-ink-2">
      {SERIES.map((s) => (
        <span key={s.key} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: s.color }} />
          {s.label}
        </span>
      ))}
    </div>
  );
}

type Point = { label: string; rent: number; laundry: number; date?: string; bikes?: number };

function Tip({ active, payload }: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as Point;
  return (
    <div className="min-w-44 rounded-xl border border-line bg-surface px-3 py-2.5 text-xs shadow-xl">
      <p className="mb-1.5 font-semibold text-ink">{p.date ? thShort(p.date) : p.label}</p>
      {SERIES.map((s) => (
        <div key={s.key} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5 text-ink-2">
            <span className="size-2 rounded-sm" style={{ background: s.color }} />
            {s.label}
          </span>
          <span className="tabular font-medium text-ink">{baht(p[s.key])}</span>
        </div>
      ))}
      {p.bikes != null && (
        <div className="flex justify-between gap-4 py-0.5 text-ink-2">
          <span>รถออกเช่า</span>
          <span className="tabular text-ink">{number(p.bikes)} คัน</span>
        </div>
      )}
      <div className="mt-1.5 flex justify-between gap-4 border-t border-line pt-1.5 font-semibold text-ink">
        <span>รวม</span>
        <span className="tabular">{baht(p.rent + p.laundry)}</span>
      </div>
    </div>
  );
}

function StackedBars({ data, highlight, height = 280 }: { data: Point[]; highlight?: string; height?: number }) {
  const dense = data.length > 16;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }} barCategoryGap={dense ? "18%" : "28%"}>
        <CartesianGrid vertical={false} stroke="var(--grid)" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tick={{ fill: "var(--muted)", fontSize: 11 }}
          interval={dense ? 1 : 0}
          tickMargin={8}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={{ fill: "var(--muted)", fontSize: 11 }}
          tickFormatter={(v: number) => compactBaht(v)}
          width={56}
        />
        <Tooltip content={Tip} cursor={{ fill: "var(--surface-2)", radius: 6 }} />
        {SERIES.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.label}
            stackId="a"
            fill={s.color}
            stroke="var(--surface)"
            strokeWidth={2}
            radius={i === SERIES.length - 1 ? [4, 4, 0, 0] : 0}
            maxBarSize={44}
          >
            {data.map((p) => (
              <Cell key={p.label} fillOpacity={highlight && p.date !== highlight ? 0.35 : 1} />
            ))}
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DailyChart({ data, highlight }: { data: DayPoint[]; highlight?: string }) {
  return <StackedBars data={data} highlight={highlight} />;
}

export function MonthlyChart({ data }: { data: MonthPoint[] }) {
  return <StackedBars data={data} height={240} />;
}
