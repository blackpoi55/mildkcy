"use client";

import { BarChart3, Table } from "lucide-react";
import { useState } from "react";
import { DateNav, useSetParam } from "@/components/date-nav";
import { Card, CardHeader, Segmented } from "@/components/ui";
import type { DayPoint } from "@/lib/analytics";
import { thShort, type Period } from "@/lib/dates";
import { baht, number } from "@/lib/format";
import { DailyChart, Legend } from "./charts";

export function DashboardControls({ period, date, today }: { period: Period; date: string; today: string }) {
  const setParam = useSetParam();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Segmented
        value={period}
        onChange={(v) => setParam("p", v)}
        options={[
          { value: "day", label: "รายวัน" },
          { value: "week", label: "รายสัปดาห์" },
          { value: "month", label: "รายเดือน" },
        ]}
      />
      <DateNav date={date} period={period} today={today} />
    </div>
  );
}

export function DailyCard({ data, period, date }: { data: DayPoint[]; period: Period; date: string }) {
  const [mode, setMode] = useState<"chart" | "table">("chart");
  const title = period === "day" ? "รายได้ 14 วันล่าสุด" : period === "week" ? "รายได้รายวันในสัปดาห์" : "รายได้รายวันในเดือน";
  return (
    <Card>
      <CardHeader
        title={title}
        subtitle={<Legend />}
        action={
          <Segmented
            value={mode}
            onChange={setMode}
            options={[
              { value: "chart", label: <BarChart3 className="size-4" aria-label="กราฟ" /> },
              { value: "table", label: <Table className="size-4" aria-label="ตาราง" /> },
            ]}
          />
        }
      />
      <div className="px-3 pt-4 pb-3 sm:px-4">
        {mode === "chart" ? (
          <DailyChart data={data} highlight={period === "day" ? date : undefined} />
        ) : (
          <div className="max-h-[280px] overflow-y-auto px-2">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface text-xs text-muted">
                <tr>
                  <th className="py-2 text-left font-medium">วันที่</th>
                  <th className="py-2 text-right font-medium">รถออก</th>
                  <th className="py-2 text-right font-medium">เช่ารถ</th>
                  <th className="py-2 text-right font-medium">ซักผ้า</th>
                  <th className="py-2 text-right font-medium">รวม</th>
                </tr>
              </thead>
              <tbody className="tabular">
                {data.map((d) => (
                  <tr key={d.date} className="border-t border-line">
                    <td className="py-1.5">{thShort(d.date)}</td>
                    <td className="py-1.5 text-right">{number(d.bikes)}</td>
                    <td className="py-1.5 text-right">{baht(d.rent)}</td>
                    <td className="py-1.5 text-right">{baht(d.laundry)}</td>
                    <td className="py-1.5 text-right font-semibold">{baht(d.rent + d.laundry)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Card>
  );
}
