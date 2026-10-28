import { connection } from "next/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/nav";
import { Skeleton } from "@/components/ui";
import { getBikes, getLaundry, getRentals, getSettings } from "@/lib/data";
import { addDays, isISODate, startOfMonth, todayISO } from "@/lib/dates";
import { RecordsClient, type RecordsTab } from "./records-client";

export const metadata = { title: "รายการทั้งหมด" };

async function RecordsData({ searchParams }: { searchParams: PageProps<"/records">["searchParams"] }) {
  const sp = await searchParams;
  await connection();
  const today = todayISO();
  const tab: RecordsTab = sp.tab === "laundry" ? "laundry" : "rent";
  // ช่วงวันที่: ค่าเริ่มต้น = เดือนนี้, all=1 = ทั้งหมด
  const all = sp.all === "1";
  const from = all ? "" : isISODate(sp.from) ? sp.from : startOfMonth(today);
  const to = all ? "" : isISODate(sp.to) ? sp.to : addDays(startOfMonth(addDays(startOfMonth(today), 32)), -1);
  const inRange = (d: string) => all || (d >= from && d <= to);

  const [rentals, laundry, bikes, settings] = await Promise.all([getRentals(), getLaundry(), getBikes(), getSettings()]);
  return (
    <RecordsClient
      tab={tab}
      from={from}
      to={to}
      today={today}
      rentals={rentals.filter((r) => inRange(r.date))}
      laundry={laundry.filter((l) => inRange(l.date))}
      bikes={bikes}
      settings={settings}
    />
  );
}

export default function RecordsPage({ searchParams }: PageProps<"/records">) {
  return (
    <>
      <PageHeader title="รายการทั้งหมด" subtitle="ค้นหา แก้ไข หรือลบรายการเช่ารถและซักผ้า ดาวน์โหลดเป็นไฟล์ Excel ได้" />
      <Suspense
        fallback={
          <div className="space-y-4">
            <Skeleton className="h-28" />
            <Skeleton className="h-[480px]" />
          </div>
        }
      >
        <RecordsData searchParams={searchParams} />
      </Suspense>
    </>
  );
}
