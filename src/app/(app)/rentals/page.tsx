import { connection } from "next/server";
import { Suspense } from "react";
import { IllustratedHeader } from "@/components/hero";
import { Skeleton } from "@/components/ui";
import { getBikes, getRentals } from "@/lib/data";
import { DueSoon } from "@/components/due-soon";
import { addDays, isISODate, nowTime, startOfMonth, startOfWeek, todayISO } from "@/lib/dates";
import { dueSoonList, lastDayOut, outstandingRentals, returnedOn } from "@/lib/rental-status";
import { RENTABLE_STATUS } from "@/lib/schema";
import { RentalsClient, type RentalMode, type RentalView } from "./rentals-client";

export const metadata = { title: "บันทึกเช่ารถ" };

async function RentalsData({ searchParams }: { searchParams: PageProps<"/rentals">["searchParams"] }) {
  const sp = await searchParams;
  await connection();
  const today = todayISO();
  const date = isISODate(sp.d) ? sp.d : today;
  const view = (["day", "week", "list"].includes(String(sp.v)) ? sp.v : "day") as RentalView;
  const mode: RentalMode = sp.mode === "return" ? "return" : "rent";
  const [bikes, rentals] = await Promise.all([getBikes(), getRentals()]);

  // ส่งเฉพาะข้อมูลช่วงเดือน/สัปดาห์ที่แสดง
  const from = startOfWeek(startOfMonth(date));
  const to = addDays(startOfMonth(date), 38);
  // รวมการเช่าที่เริ่มก่อนช่วงนี้แต่รถยังออกไปอยู่ในช่วง (เช่าหลายวัน)
  const inRange = rentals.filter((r) => r.date <= to && lastDayOut(r, today) >= from);
  const usedBikeIds = new Set(inRange.map((r) => r.bikeId));
  const visibleBikes = bikes.filter((b) => b.status === RENTABLE_STATUS || usedBikeIds.has(b.id));

  // แท็บคืนรถ: รถที่ยังไม่คืนทั้งหมด (ไม่จำกัดเดือนที่ดูอยู่)
  const now = nowTime();
  const outstanding = outstandingRentals(rentals, today, now);

  return (
    <>
      {mode === "rent" && (
        <DueSoon
          items={dueSoonList(rentals, today, now)}
          bikes={bikes}
          today={today}
          showCustomer
          href="/rentals?mode=return"
        />
      )}
      <RentalsClient
        bikes={visibleBikes}
        allBikes={bikes}
        rentals={inRange}
        date={date}
        today={today}
        view={view}
        mode={mode}
        outstanding={outstanding}
        returnedToday={returnedOn(rentals, today)}
      />
    </>
  );
}

export default function RentalsPage({ searchParams }: PageProps<"/rentals">) {
  return (
    <>
      <IllustratedHeader
        title="บันทึกเช่ารถ"
        subtitle="แท็บ “เช่ารถ” สำหรับปล่อยเช่า · แท็บ “คืนรถ” รวมรถที่ยังไม่คืนทั้งหมด"
        image="/illustrations/scooter.svg"
      />
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
