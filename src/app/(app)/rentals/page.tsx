import { connection } from "next/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/nav";
import { Skeleton } from "@/components/ui";
import { getBikes, getRentals } from "@/lib/data";
import { addDays, isISODate, startOfMonth, startOfWeek, todayISO } from "@/lib/dates";
import { RENTABLE_STATUS } from "@/lib/schema";
import { RentalsClient, type RentalView } from "./rentals-client";

export const metadata = { title: "บันทึกเช่ารถ" };

async function RentalsData({ searchParams }: { searchParams: PageProps<"/rentals">["searchParams"] }) {
  const sp = await searchParams;
  await connection();
  const today = todayISO();
  const date = isISODate(sp.d) ? sp.d : today;
  const view = (["day", "week", "list"].includes(String(sp.v)) ? sp.v : "day") as RentalView;
  const [bikes, rentals] = await Promise.all([getBikes(), getRentals()]);

  // ส่งเฉพาะข้อมูลช่วงเดือน/สัปดาห์ที่แสดง
  const from = startOfWeek(startOfMonth(date));
  const to = addDays(startOfMonth(date), 38);
  const inRange = rentals.filter((r) => r.date >= from && r.date <= to);
  const usedBikeIds = new Set(inRange.map((r) => r.bikeId));
  const visibleBikes = bikes.filter((b) => b.status === RENTABLE_STATUS || usedBikeIds.has(b.id));

  return <RentalsClient bikes={visibleBikes} allBikes={bikes} rentals={inRange} date={date} today={today} view={view} />;
}

export default function RentalsPage({ searchParams }: PageProps<"/rentals">) {
  return (
    <>
      <PageHeader title="บันทึกเช่ารถ" subtitle="แตะที่รถเพื่อบันทึกว่าถูกเช่าในวันนั้น ระบบคิดเงินให้อัตโนมัติ" />
      <Suspense
        fallback={
          <div className="space-y-4">
            <Skeleton className="h-12 w-80" />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 9 }, (_, i) => (
                <Skeleton key={i} className="h-28" />
              ))}
            </div>
          </div>
        }
      >
        <RentalsData searchParams={searchParams} />
      </Suspense>
    </>
  );
}
