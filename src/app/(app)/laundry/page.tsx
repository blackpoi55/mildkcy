import { connection } from "next/server";
import { Suspense } from "react";
import { IllustratedHeader } from "@/components/hero";
import { Skeleton } from "@/components/ui";
import { getLaundry, getSettings } from "@/lib/data";
import { isISODate, todayISO } from "@/lib/dates";
import { LaundryClient } from "./laundry-client";

export const metadata = { title: "ซักผ้า" };

async function LaundryData({ searchParams }: { searchParams: PageProps<"/laundry">["searchParams"] }) {
  const sp = await searchParams;
  await connection();
  const today = todayISO();
  const date = isISODate(sp.d) ? sp.d : today;
  const [laundry, settings] = await Promise.all([getLaundry(), getSettings()]);
  const month = laundry.filter((l) => l.date.slice(0, 7) === date.slice(0, 7));
  return <LaundryClient items={month} settings={settings} date={date} today={today} />;
}

export default function LaundryPage({ searchParams }: PageProps<"/laundry">) {
  return (
    <>
      <IllustratedHeader
        title="ซักผ้า"
        subtitle="เลือกห้อง ใส่น้ำหนัก ระบบคิดราคาให้ตามตารางราคา"
        image="/illustrations/laundry.svg"
      />
      <Suspense
        fallback={
          <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
            <Skeleton className="h-[560px]" />
            <Skeleton className="h-[560px]" />
          </div>
        }
      >
        <LaundryData searchParams={searchParams} />
      </Suspense>
    </>
  );
}
