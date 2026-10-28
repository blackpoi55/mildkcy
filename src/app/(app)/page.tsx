import { AlertTriangle, ArrowDownRight, ArrowUpRight, Bike, CalendarCheck, CircleX, Eye, Gauge, Shirt, Wallet } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";
import { ResortHero } from "@/components/hero";
import { Badge, Card, CardHeader, Empty, Skeleton } from "@/components/ui";
import { buildDashboard, type Dashboard } from "@/lib/analytics";
import { getBikes, getLaundry, getRentals } from "@/lib/data";
import { isISODate, nowClock, nowTime, periodLabel, thShort, todayISO, type Period } from "@/lib/dates";
import { baht, number, pctChange } from "@/lib/format";
import { isAuthed } from "@/lib/session";
import { MonthlyChart, Legend } from "./charts";
import { DailyCard, DashboardControls } from "./dashboard-parts";
import { TodayPanel } from "./today-panel";

const PREV_LABEL: Record<Period, string> = { day: "เมื่อวาน", week: "สัปดาห์ก่อน", month: "เดือนก่อน" };

function Delta({ cur, prev, period }: { cur: number; prev: number; period: Period }) {
  const pct = pctChange(cur, prev);
  if (pct == null) return <span className="text-xs text-muted">ไม่มีข้อมูล{PREV_LABEL[period]}</span>;
  const up = pct >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="flex items-center gap-1 text-xs">
      <span className={`flex items-center font-semibold ${up ? "text-good" : "text-bad"}`}>
        <Icon className="size-3.5" />
        {up ? "+" : ""}
        {number(pct, 1)}%
      </span>
      <span className="text-muted">จาก{PREV_LABEL[period]}</span>
    </span>
  );
}

function Kpi({
  icon,
  label,
  value,
  sub,
  hero,
  tint,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  sub: ReactNode;
  hero?: boolean;
  tint: string;
}) {
  return (
    <Card className={hero ? "relative overflow-hidden border-transparent bg-gradient-to-br from-brand-2 to-violet-600 text-white" : "p-0"}>
      <div className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <span className={`grid size-8 place-items-center rounded-lg ${hero ? "bg-white/20 text-white" : tint}`}>{icon}</span>
          <span className={`text-sm font-medium ${hero ? "text-white/85" : "text-ink-2"}`}>{label}</span>
        </div>
        <p className="tabular text-2xl font-bold tracking-tight sm:text-3xl">{value}</p>
        <div className={`mt-1.5 ${hero ? "[&_*]:!text-white/85" : ""}`}>{sub}</div>
      </div>
      {hero && <div className="pointer-events-none absolute -top-10 -right-10 size-40 rounded-full bg-white/10" />}
    </Card>
  );
}

function Content({ d, today, canEdit }: { d: Dashboard; today: string; canEdit: boolean }) {
  const { cur, prev, period } = d;
  const maxBike = Math.max(1, ...d.topBikes.map((b) => b.revenue));
  const maxRoom = Math.max(1, ...d.rooms.map((r) => r.revenue));

  return (
    <div className="space-y-6">
      {!canEdit && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand/30 bg-brand-soft px-4 py-3 text-sm text-brand-ink">
          <span className="flex items-center gap-2">
            <Eye className="size-4 shrink-0" />
            ดูได้อย่างเดียว — เข้าสู่ระบบเพื่อบันทึกเช่ารถ ซักผ้า และจัดการข้อมูลรถ
          </span>
          <Link href="/login" className="rounded-lg bg-brand-2 px-3 py-1.5 font-medium text-white">
            เข้าสู่ระบบ
          </Link>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Kpi
          hero
          icon={<Wallet className="size-4" />}
          label="รายได้รวม"
          value={baht(cur.total)}
          sub={<Delta cur={cur.total} prev={prev.total} period={period} />}
          tint=""
        />
        <Kpi
          icon={<Bike className="size-4" />}
          label="เช่ารถ"
          value={baht(cur.rent)}
          sub={<Delta cur={cur.rent} prev={prev.rent} period={period} />}
          tint="bg-rent/15 text-rent"
        />
        <Kpi
          icon={<Shirt className="size-4" />}
          label="ซักผ้า"
          value={baht(cur.laundry)}
          sub={
            cur.laundryUnpaid > 0 ? (
              <span className="text-xs text-warn">ค้างชำระ {baht(cur.laundryUnpaid)}</span>
            ) : (
              <Delta cur={cur.laundry} prev={prev.laundry} period={period} />
            )
          }
          tint="bg-laundry/15 text-laundry"
        />
        <Kpi
          icon={<Gauge className="size-4" />}
          label="อัตราการใช้รถ"
          value={`${number(cur.occupancy, 0)}%`}
          sub={
            <span className="text-xs text-muted">
              {number(cur.bikeDays)} คัน-วัน · รถพร้อมเช่า {d.rentable} คัน
            </span>
          }
          tint="bg-brand-soft text-brand"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <DailyCard data={d.daily} period={period} date={d.date} />
        </div>
        <Card>
          <CardHeader
            title={period === "day" ? `สถานะรถ · ${thShort(d.date)}` : "รถทำเงินสูงสุด"}
            subtitle={period === "day" ? `ออกเช่า ${d.day.rented} คัน · ว่าง ${d.day.free.length} คัน` : periodLabel(period, d.date)}
            action={canEdit && (
<Link href={`/rentals?d=${d.date}`} className="text-sm font-medium text-brand hover:underline">
                บันทึก
              </Link>
)}
          />
          <div className="p-5">
            {period === "day" && d.day.free.length > 0 && (
              <div className="mb-5">
                <p className="mb-2 text-xs font-medium text-muted">รถว่าง</p>
                <div className="flex flex-wrap gap-1.5">
                  {d.day.free.map((b) => (
                    <Badge key={b.id} tone="neutral">
                      {b.plate}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {d.topBikes.length === 0 ? (
              <Empty icon={<CalendarCheck />} image="/illustrations/scooter.svg" title="ยังไม่มีการเช่าในช่วงนี้" />
            ) : (
              <ul className="space-y-3.5">
                {d.topBikes.slice(0, 8).map((b) => (
                  <li key={b.id}>
                    <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                      <span className="truncate">
                        <span className="font-semibold">{b.plate}</span> <span className="text-xs text-muted">{b.model}</span>
                      </span>
                      <span className="tabular shrink-0 font-semibold">{baht(b.revenue)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                        <div className="h-full rounded-full bg-rent" style={{ width: `${(b.revenue / maxBike) * 100}%` }} />
                      </div>
                      <span className="tabular w-12 text-right text-xs text-muted">{number(b.days)} วัน</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="แนวโน้ม 12 เดือน" subtitle={<Legend />} />
          <div className="px-3 pt-4 pb-3 sm:px-4">
            <MonthlyChart data={d.months} />
          </div>
        </Card>
        <Card>
          <CardHeader
            title="ซักผ้ารายห้อง"
            subtitle={`${number(cur.laundryCount)} ครั้ง · ${number(cur.laundryKg, 1)} กก.`}
            action={canEdit && (
<Link href={`/laundry?d=${d.date}`} className="text-sm font-medium text-brand hover:underline">
                บันทึก
              </Link>
)}
          />
          <div className="p-5">
            {d.rooms.length === 0 ? (
              <Empty icon={<Shirt />} image="/illustrations/laundry.svg" title="ยังไม่มีรายการซักผ้าในช่วงนี้" />
            ) : (
              <ul className="space-y-3">
                {d.rooms.slice(0, 10).map((r) => (
                  <li key={r.room} className="flex items-center gap-3 text-sm">
                    <span className="w-14 shrink-0 font-semibold">ห้อง {r.room}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                      <div className="h-full rounded-full bg-laundry" style={{ width: `${(r.revenue / maxRoom) * 100}%` }} />
                    </div>
                    <span className="tabular w-20 shrink-0 text-right font-medium">{baht(r.revenue)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-warn" /> แจ้งเตือนเอกสารรถ
            </span>
          }
          subtitle="ภาษีหรือบัตรที่หมดอายุแล้ว หรือจะหมดภายใน 30 วัน"
          action={canEdit && (
<Link href="/bikes" className="text-sm font-medium text-brand hover:underline">
              ดูรถทั้งหมด
            </Link>
)}
        />
        <div className="p-5">
          {d.alerts.length === 0 ? (
            <p className="text-sm text-muted">ไม่มีรายการที่ต้องดำเนินการ 🎉</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {d.alerts.map((a) => (
                <div
                  key={`${a.bike.id}-${a.kind}`}
                  className={`flex items-center gap-3 rounded-xl border p-3 ${a.tone === "bad" ? "border-bad/30 bg-bad-soft" : "border-warn/30 bg-warn-soft"}`}
                >
                  {a.tone === "bad" ? <CircleX className="size-5 shrink-0 text-bad" /> : <AlertTriangle className="size-5 shrink-0 text-warn" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">
                      {a.bike.plate} <span className="font-normal text-muted">· {a.bike.model}</span>
                    </p>
                    <p className={`text-xs ${a.tone === "bad" ? "text-bad" : "text-warn"}`}>
                      {a.kind}
                      {a.tone === "bad" ? "หมดอายุ" : "ใกล้หมด"} ({thShort(a.date)}) · {a.label}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
      <p className="text-center text-xs text-muted">ข้อมูล ณ {thShort(today)}</p>
    </div>
  );
}

async function DashboardData({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const sp = await searchParams;
  await connection();
  const today = todayISO();
  const period = (["day", "week", "month"].includes(String(sp.p)) ? sp.p : "month") as Period;
  const date = isISODate(sp.d) ? sp.d : today;
  const [bikes, rentals, laundry, canEdit] = await Promise.all([getBikes(), getRentals(), getLaundry(), isAuthed()]);
  const d = buildDashboard(period, date, today, bikes, rentals, laundry);
  const todayRentals = rentals.filter((r) => r.date === today);
  const todayLaundry = laundry.filter((l) => l.date === today);
  const hour = Number(nowTime().slice(0, 2));
  const greeting = hour < 12 ? "สวัสดีตอนเช้า ☀️" : hour < 17 ? "สวัสดีตอนบ่าย 🌴" : "สวัสดีตอนเย็น 🌅";
  return (
    <>
      <ResortHero
        greeting={greeting}
        dateLabel={periodLabel("day", today)}
        stats={[
          {
            icon: <Bike className="size-4" />,
            label: "รถออกวันนี้",
            value: `${todayRentals.filter((r) => r.days > 0).length}/${d.rentable} คัน`,
          },
          {
            icon: <Wallet className="size-4" />,
            label: "รายได้วันนี้",
            value: baht(todayRentals.reduce((s, r) => s + r.total, 0) + todayLaundry.reduce((s, l) => s + l.price, 0)),
          },
          { icon: <Shirt className="size-4" />, label: "ซักผ้าวันนี้", value: `${todayLaundry.length} รายการ` },
        ]}
      />
      <TodayPanel
        today={today}
        dateLabel={periodLabel("day", today)}
        updatedAt={nowClock()}
        bikes={bikes}
        rentals={todayRentals}
        laundry={todayLaundry}
        rentableCount={d.rentable}
        canEdit={canEdit}
      />
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">ภาพรวมธุรกิจ</h2>
          <p className="mt-1 text-sm text-muted">{d.range.label}</p>
        </div>
        <DashboardControls period={period} date={date} today={today} />
      </div>
      <Content d={d} today={today} canEdit={canEdit} />
    </>
  );
}

export default function DashboardPage({ searchParams }: PageProps<"/">) {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <Skeleton className="h-52 sm:h-60" />
          <Skeleton className="h-12 w-72" />
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-36" />
            ))}
          </div>
          <Skeleton className="h-96" />
        </div>
      }
    >
      <DashboardData searchParams={searchParams} />
    </Suspense>
  );
}
