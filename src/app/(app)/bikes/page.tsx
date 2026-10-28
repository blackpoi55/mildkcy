import { Suspense } from "react";
import { IllustratedHeader } from "@/components/hero";
import { Skeleton } from "@/components/ui";
import { getBikes, getRentals } from "@/lib/data";
import { todayISO } from "@/lib/dates";
import { BikesClient } from "./bikes-client";

export const metadata = { title: "ทะเบียนรถ" };

async function BikesData() {
  const [bikes, rentals] = await Promise.all([getBikes(), getRentals()]);
  const today = todayISO(); // หลัง getBikes() ซึ่งเรียก connection() แล้ว
  const month = today.slice(0, 7);
  const stats: Record<string, { monthDays: number; monthRevenue: number; totalRevenue: number; lastDate: string }> = {};
  for (const r of rentals) {
    const s = (stats[r.bikeId] ??= { monthDays: 0, monthRevenue: 0, totalRevenue: 0, lastDate: "" });
    s.totalRevenue += r.total;
    if (r.date.startsWith(month)) {
      s.monthDays += r.days;
      s.monthRevenue += r.total;
    }
    if (r.days > 0 && r.date > s.lastDate) s.lastDate = r.date;
  }
  return <BikesClient bikes={bikes} stats={stats} today={today} />;
}

export default function BikesPage() {
  return (
    <>
      <IllustratedHeader
        title="ทะเบียนรถ"
        subtitle="ข้อมูลรถทุกคัน ภาษี เอกสารโอน และราคาเช่า"
        image="/illustrations/scooter.svg"
        flip
      />
      <Suspense
        fallback={
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-52" />
            ))}
          </div>
        }
      >
        <BikesData />
      </Suspense>
    </>
  );
}
