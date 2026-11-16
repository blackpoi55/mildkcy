import { TreePalm } from "lucide-react";
import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";
import { DateNav } from "@/components/date-nav";
import { PageHeader } from "@/components/nav";
import { Skeleton } from "@/components/ui";
import { getBikes, getExpenses, getLaundry, getRentals } from "@/lib/data";
import { TH_DAYS, dayOfWeek, isISODate, nowTime, thLong, thShort, todayISO } from "@/lib/dates";
import { baht, bahtText, number } from "@/lib/format";
import { returnDateOf } from "@/lib/rental-status";
import type { Expense, Laundry, Rental } from "@/lib/schema";
import { ExpensePanel } from "./expenses";
import { PrintButton } from "./print-button";

// ชื่อหน้าเว็บ = ชื่อไฟล์ PDF ตอนกด Ctrl+P หรือปุ่มพิมพ์ จึงใส่วันที่ของรายงานไว้ด้วย
export async function generateMetadata({ searchParams }: PageProps<"/report">) {
  const sp = await searchParams;
  await connection();
  const date = isISODate(sp.d) ? sp.d : todayISO();
  return { title: { absolute: `สรุปรายรับ ${date}` } };
}

const byTime = (a: { time: string }, b: { time: string }) => (a.time || "99").localeCompare(b.time || "99");
const dash = (n: number) => (n ? baht(n) : "-");
/** "17 พ.ย." — ไม่ใส่ปีในตาราง ให้แถวสั้นลง */
const dm = (iso: string) => thShort(iso).replace(/ \d+$/, "");

// ---------------------------------------------------------------- ส่วนประกอบของใบรายงาน (สีคงที่ ไม่เปลี่ยนตามโหมดมืด)

function Stat({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: "rent" | "laundry" | "total" }) {
  const box = {
    rent: "border-sky-200 bg-sky-50",
    laundry: "border-orange-200 bg-orange-50",
    total: "border-indigo-700 bg-gradient-to-br from-indigo-600 to-violet-600 text-white",
  }[tone];
  return (
    <div className={`rounded-xl border px-4 py-3 print:py-2 ${box}`}>
      <p className={`text-xs font-medium ${tone === "total" ? "text-white/80" : "text-slate-500"}`}>{label}</p>
      <p className="tabular mt-0.5 text-2xl leading-tight font-bold print:text-xl">{value}</p>
      <p className={`mt-0.5 text-[11px] ${tone === "total" ? "text-white/80" : "text-slate-500"}`}>{sub}</p>
    </div>
  );
}

function Section({ no, title, note, children }: { no: number; title: string; note: string; children: ReactNode }) {
  return (
    <section className="mt-7 print:mt-3.5">
      <div className="mb-2 flex break-after-avoid items-baseline justify-between gap-3 border-b-2 border-slate-800 pb-1.5">
        <h3 className="text-[15px] font-bold">
          <span className="mr-1.5 text-indigo-600">{no}.</span>
          {title}
        </h3>
        <p className="text-xs text-slate-500">{note}</p>
      </div>
      <div className="overflow-x-auto print:overflow-visible">{children}</div>
    </section>
  );
}

const th = "px-2 py-1.5 text-left text-[11px] font-semibold text-slate-600 whitespace-nowrap";
const td = "px-2 py-1.5 align-top print:py-1";
const num = "text-right tabular whitespace-nowrap";

function Empty({ cols, text }: { cols: number; text: string }) {
  return (
    <tr>
      <td colSpan={cols} className="py-5 text-center text-slate-400">
        {text}
      </td>
    </tr>
  );
}

function RentTable({ rows, model }: { rows: Rental[]; model: (id: string) => string }) {
  const sum = (k: "days" | "discount" | "fine" | "total") => rows.reduce((s, r) => s + r[k], 0);
  return (
    <table className="w-full min-w-[640px] border-collapse text-xs">
      <thead>
        <tr className="bg-slate-100">
          <th className={`${th} w-8 text-center`}>#</th>
          <th className={th}>เวลา</th>
          <th className={th}>รถ</th>
          <th className={th}>ลูกค้า</th>
          <th className={th}>สถานะคืนรถ</th>
          <th className={`${th} text-right`}>วัน</th>
          <th className={`${th} text-right`}>ราคา/วัน</th>
          <th className={`${th} text-right`}>ส่วนลด</th>
          <th className={`${th} text-right`}>ค่าปรับ</th>
          <th className={`${th} text-right`}>ยอดรวม</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && <Empty cols={10} text="ไม่มีรายการเช่ารถในวันนี้" />}
        {rows.map((r, i) => (
          <tr key={r.id} className="break-inside-avoid border-b border-slate-200">
            <td className={`${td} text-center text-slate-400`}>{i + 1}</td>
            <td className={`${td} tabular whitespace-nowrap`}>{r.time || "-"}</td>
            <td className={td}>
              <p className="font-semibold whitespace-nowrap">{r.plate}</p>
              <p className="text-[10px] whitespace-nowrap text-slate-500">{model(r.bikeId)}</p>
            </td>
            <td className={td}>
              <p>{r.customer || "-"}</p>
              {r.note && <p className="text-[10px] text-slate-500">หมายเหตุ: {r.note}</p>}
            </td>
            <td className={`${td} whitespace-nowrap`}>
              {r.returnTime ? (
                <span className="text-emerald-700">
                  คืนแล้ว {dm(returnDateOf(r))} {r.returnTime}
                </span>
              ) : r.dueDate ? (
                <span className="text-slate-600">
                  กำหนดคืน {dm(r.dueDate)} {r.dueTime}
                </span>
              ) : (
                <span className="text-slate-400">-</span>
              )}
            </td>
            <td className={`${td} ${num}`}>{number(r.days, 1)}</td>
            <td className={`${td} ${num}`}>{baht(r.price)}</td>
            <td className={`${td} ${num} ${r.discount ? "text-rose-600" : ""}`}>{r.discount ? `-${baht(r.discount)}` : "-"}</td>
            <td className={`${td} ${num}`}>{dash(r.fine)}</td>
            <td className={`${td} ${num} font-semibold`}>{baht(r.total)}</td>
          </tr>
        ))}
      </tbody>
      {rows.length > 0 && (
        <tfoot>
          <tr className="bg-sky-50 font-semibold">
            <td colSpan={5} className={`${td} text-right`}>
              รวมเช่ารถ {rows.length} รายการ
            </td>
            <td className={`${td} ${num}`}>{number(sum("days"), 1)}</td>
            <td className={td} />
            <td className={`${td} ${num} ${sum("discount") ? "text-rose-600" : ""}`}>{sum("discount") ? `-${baht(sum("discount"))}` : "-"}</td>
            <td className={`${td} ${num}`}>{dash(sum("fine"))}</td>
            <td className={`${td} ${num} text-sky-800`}>{baht(sum("total"))}</td>
          </tr>
        </tfoot>
      )}
    </table>
  );
}

function WashTable({ rows }: { rows: Laundry[] }) {
  const kg = rows.reduce((s, l) => s + l.kg, 0);
  const total = rows.reduce((s, l) => s + l.price, 0);
  return (
    <table className="w-full min-w-[520px] border-collapse text-xs">
      <thead>
        <tr className="bg-slate-100">
          <th className={`${th} w-8 text-center`}>#</th>
          <th className={th}>เวลา</th>
          <th className={th}>ห้อง</th>
          <th className={th}>หมายเหตุ</th>
          <th className={th}>การชำระ</th>
          <th className={`${th} text-right`}>น้ำหนัก (กก.)</th>
          <th className={`${th} text-right`}>ราคา</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && <Empty cols={7} text="ไม่มีรายการซักผ้าในวันนี้" />}
        {rows.map((l, i) => (
          <tr key={l.id} className="break-inside-avoid border-b border-slate-200">
            <td className={`${td} text-center text-slate-400`}>{i + 1}</td>
            <td className={`${td} tabular whitespace-nowrap`}>{l.time || "-"}</td>
            <td className={`${td} font-semibold`}>{l.room || "-"}</td>
            <td className={`${td} text-slate-600`}>{l.note || "-"}</td>
            <td className={`${td} whitespace-nowrap`}>
              {l.paid ? <span className="text-emerald-700">ชำระแล้ว</span> : <span className="font-semibold text-rose-600">ค้างชำระ</span>}
            </td>
            <td className={`${td} ${num}`}>{number(l.kg, 2)}</td>
            <td className={`${td} ${num} font-semibold`}>{baht(l.price)}</td>
          </tr>
        ))}
      </tbody>
      {rows.length > 0 && (
        <tfoot>
          <tr className="bg-orange-50 font-semibold">
            <td colSpan={5} className={`${td} text-right`}>
              รวมซักผ้า {rows.length} รายการ
            </td>
            <td className={`${td} ${num}`}>{number(kg, 2)}</td>
            <td className={`${td} ${num} text-orange-800`}>{baht(total)}</td>
          </tr>
        </tfoot>
      )}
    </table>
  );
}

function ExpenseTable({ rows }: { rows: Expense[] }) {
  const total = rows.reduce((s, e) => s + e.amount, 0);
  return (
    <table className="w-full min-w-[520px] border-collapse text-xs">
      <thead>
        <tr className="bg-slate-100">
          <th className={`${th} w-8 text-center`}>#</th>
          <th className={th}>เวลา</th>
          <th className={th}>รายการ</th>
          <th className={th}>ผู้เบิก</th>
          <th className={th}>หมายเหตุ</th>
          <th className={`${th} text-right`}>จำนวนเงิน</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && <Empty cols={6} text="ไม่มีการเบิกเงินในวันนี้" />}
        {rows.map((e, i) => (
          <tr key={e.id} className="break-inside-avoid border-b border-slate-200">
            <td className={`${td} text-center text-slate-400`}>{i + 1}</td>
            <td className={`${td} tabular whitespace-nowrap`}>{e.time || "-"}</td>
            <td className={`${td} font-semibold`}>{e.item}</td>
            <td className={td}>{e.by || "-"}</td>
            <td className={`${td} text-slate-600`}>{e.note || "-"}</td>
            <td className={`${td} ${num} font-semibold text-rose-600`}>-{baht(e.amount)}</td>
          </tr>
        ))}
      </tbody>
      {rows.length > 0 && (
        <tfoot>
          <tr className="bg-rose-50 font-semibold">
            <td colSpan={5} className={`${td} text-right`}>
              รวมเบิก {rows.length} รายการ
            </td>
            <td className={`${td} ${num} text-rose-700`}>-{baht(total)}</td>
          </tr>
        </tfoot>
      )}
    </table>
  );
}

/** ช่องเซ็นชื่อเปล่า ๆ ให้เขียนด้วยมือบนกระดาษ */
function SignBox({ title, amountLine }: { title: string; amountLine?: boolean }) {
  const line = "flex items-end gap-2 text-xs text-slate-600";
  const dots = "flex-1 border-b border-dotted border-slate-400";
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-slate-300 px-5 pt-4 pb-5 print:gap-2 print:pt-2.5 print:pb-3">
      <p className="text-center text-sm font-bold">{title}</p>
      {amountLine && (
        <p className={line}>
          ได้รับเงินจำนวน <span className={dots} /> บาท
        </p>
      )}
      {/* ดันบรรทัดลงชื่อลงล่าง ให้สองช่องตรงกัน */}
      <div className="mt-auto flex flex-col gap-4 pt-6 print:gap-2.5 print:pt-2">
        <p className={line}>
          ลงชื่อ <span className={dots} />
        </p>
        <p className={`${line} justify-center`}>
          ( <span className="w-44 border-b border-dotted border-slate-400" /> )
        </p>
        <p className={line}>
          ตำแหน่ง <span className={dots} />
        </p>
        <p className={line}>
          วันที่ <span className={dots} />
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- ข้อมูล

async function ReportData({ searchParams }: { searchParams: PageProps<"/report">["searchParams"] }) {
  const sp = await searchParams;
  await connection();
  const today = todayISO();
  const date = isISODate(sp.d) ? sp.d : today;
  const [bikes, rentals, laundry, expenses] = await Promise.all([getBikes(), getRentals(), getLaundry(), getExpenses()]);
  const bikeById = new Map(bikes.map((b) => [b.id, b]));
  const model = (id: string) => {
    const b = bikeById.get(id);
    return b ? `${b.brand} ${b.model}`.trim() : "";
  };

  // รายได้เช่ารถนับที่วันเริ่มเช่า (เหมือนแดชบอร์ด)
  const rents = rentals.filter((r) => r.date === date).sort((a, b) => byTime(a, b) || a.plate.localeCompare(b.plate));
  const washes = laundry.filter((l) => l.date === date).sort(byTime);
  const rentTotal = rents.reduce((s, r) => s + r.total, 0);
  const rentDays = rents.reduce((s, r) => s + r.days, 0);
  const washTotal = washes.reduce((s, l) => s + l.price, 0);
  const washKg = washes.reduce((s, l) => s + l.kg, 0);
  const unpaid = washes.filter((l) => !l.paid).reduce((s, l) => s + l.price, 0);
  const spends = expenses
    .filter((e) => e.date === date)
    .sort((a, b) => byTime(a, b) || a.createdAt.localeCompare(b.createdAt));
  const spent = spends.reduce((s, e) => s + e.amount, 0);
  const grand = rentTotal + washTotal;
  // เงินที่ต้องมีอยู่ในมือ = รายรับ − ค่าซักผ้าที่ยังไม่ได้เงิน − เงินที่เบิกไปใช้
  const handIn = grand - unpaid - spent;
  const dayLabel = `วัน${TH_DAYS[dayOfWeek(date)]}ที่ ${thLong(date)}`;

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <DateNav date={date} period="day" today={today} />
        <PrintButton />
      </div>
      <p className="mb-4 text-xs text-muted print:hidden">
        กด “บันทึก PDF / พิมพ์” หรือ Ctrl+P แล้วเลือกเครื่องพิมพ์เป็น “บันทึกเป็น PDF” (Save as PDF) · กระดาษ A4
      </p>
      <ExpensePanel date={date} items={spends} />

      {/* เลขหน้า + ชื่อรายงานที่ขอบล่างกระดาษทุกหน้า (ข้อมูลเยอะจนหลายหน้า หัวหน้าจะรู้ว่าครบหรือไม่) */}
      <style>{`@page {
        @bottom-left { content: "Private Paradise Resort · สรุปรายรับ ${thLong(date)}"; font: 8pt var(--font-thai), sans-serif; color: #94a3b8; }
        @bottom-right { content: "หน้า " counter(page) " / " counter(pages); font: 8pt var(--font-thai), sans-serif; color: #94a3b8; }
      }`}</style>
      <article className="report mx-auto w-full max-w-[210mm] rounded-2xl bg-white p-5 text-slate-800 shadow-xl ring-1 ring-black/5 sm:p-10 print:max-w-none print:rounded-none print:p-0 print:shadow-none print:ring-0">
        {/* หัวรายงาน */}
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white">
              <TreePalm className="size-6" />
            </span>
            <div>
              <p className="text-lg leading-tight font-bold">Private Paradise Resort</p>
              <p className="text-xs text-slate-500">เกาะช้าง · ระบบจัดการเช่ารถ & ซักผ้า</p>
            </div>
          </div>
          <div className="sm:text-right print:text-right">
            <h2 className="text-xl font-bold text-indigo-700">รายงานสรุปรายรับประจำวัน</h2>
            <p className="text-sm font-medium">{dayLabel}</p>
            <p className="text-[11px] text-slate-500">
              เลขที่ PPR-{date.replaceAll("-", "")} · พิมพ์เมื่อ {thShort(today)} {nowTime()} น.
            </p>
          </div>
        </header>
        <div className="mt-4 h-1 rounded-full bg-gradient-to-r from-indigo-600 via-violet-500 to-sky-400" />

        {/* สรุปยอด */}
        <div className="mt-6 grid gap-3 sm:grid-cols-3 print:mt-4 print:grid-cols-3">
          <Stat
            tone="rent"
            label="รายได้เช่ารถ"
            value={baht(rentTotal)}
            sub={`${rents.length} รายการ · ${number(rentDays, 1)} วันเช่า`}
          />
          <Stat
            tone="laundry"
            label="รายได้ซักผ้า"
            value={baht(washTotal)}
            sub={`${washes.length} รายการ · ${number(washKg, 2)} กก.`}
          />
          <Stat tone="total" label="รวมรายรับทั้งสิ้น" value={baht(grand)} sub={`${rents.length + washes.length} รายการ`} />
        </div>

        <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <tbody>
              {/* รายรับแยกประเภทอยู่ในกล่องด้านบนแล้ว — ตรงนี้แสดงแค่ รวมรายรับ − รายการหัก = ยอดนำส่ง */}
              {(unpaid > 0 || spent > 0) && (
                <tr className="border-b border-slate-200">
                  <td className="px-4 py-2 print:py-1.5 text-slate-600">รวมรายรับทั้งสิ้น</td>
                  <td className="tabular px-4 py-2 print:py-1.5 text-right">{baht(grand)}</td>
                </tr>
              )}
              {unpaid > 0 && (
                <tr className="border-b border-slate-200">
                  <td className="px-4 py-2 print:py-1.5 text-rose-600">หัก ค่าซักผ้าที่ลูกค้ายังค้างชำระ</td>
                  <td className="tabular px-4 py-2 print:py-1.5 text-right text-rose-600">-{baht(unpaid)}</td>
                </tr>
              )}
              {spent > 0 && (
                <tr className="border-b border-slate-200">
                  <td className="px-4 py-2 print:py-1.5 text-rose-600">หัก เบิกเงินไปใช้ ({spends.length} รายการ)</td>
                  <td className="tabular px-4 py-2 print:py-1.5 text-right text-rose-600">-{baht(spent)}</td>
                </tr>
              )}
              <tr className="bg-indigo-50">
                <td className="px-4 py-3 print:py-2">
                  <p className="font-bold text-indigo-900">ยอดเงินที่นำส่ง</p>
                  <p className="text-xs text-indigo-700">({bahtText(handIn)})</p>
                </td>
                <td className="tabular px-4 py-3 text-right text-2xl font-bold text-indigo-900 print:py-2">{baht(handIn)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <Section no={1} title="รายละเอียดการเช่ารถ" note="นับรายได้ในวันที่เริ่มเช่า">
          <RentTable rows={rents} model={model} />
        </Section>

        <Section no={2} title="รายละเอียดซักผ้า" note={unpaid ? `ค้างชำระ ${baht(unpaid)}` : "ชำระครบทุกรายการ"}>
          <WashTable rows={washes} />
        </Section>

        <Section no={3} title="รายการเบิกเงินไปใช้" note={spent ? `รวมเบิก ${baht(spent)}` : "ไม่มีการเบิก"}>
          <ExpenseTable rows={spends} />
        </Section>

        {/* ช่องเซ็น */}
        <section className="mt-10 break-inside-avoid print:mt-4">
          {/* ข้อมูลเยอะจนช่องเซ็นไปอยู่หน้าสุดท้าย — สรุปยอดซ้ำไว้ตรงนี้ หัวหน้าไม่ต้องพลิกกลับไปหน้าแรก */}
          <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-600">
            <div className="flex flex-wrap gap-x-6 gap-y-1">
              <span>
                เช่ารถ {rents.length} รายการ <b className="tabular text-slate-800">{baht(rentTotal)}</b>
              </span>
              <span>
                ซักผ้า {washes.length} รายการ <b className="tabular text-slate-800">{baht(washTotal)}</b>
              </span>
              {unpaid > 0 && (
                <span className="text-rose-600">
                  ค้างชำระ <b className="tabular">-{baht(unpaid)}</b>
                </span>
              )}
              {spent > 0 && (
                <span className="text-rose-600">
                  เบิกใช้ <b className="tabular">-{baht(spent)}</b>
                </span>
              )}
              <span className="ml-auto font-semibold text-indigo-900">
                ยอดเงินที่นำส่ง <span className="tabular text-sm">{baht(handIn)}</span>
              </span>
            </div>
            <p className="mt-1.5 border-t border-slate-200 pt-1.5">
              ข้าพเจ้าขอรับรองว่ารายการข้างต้นถูกต้อง และได้นำส่งเงินจำนวน{" "}
              <b className="tabular text-slate-800">{baht(handIn)}</b> ({bahtText(handIn)}) ครบถ้วนแล้ว
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 print:grid-cols-2">
            <SignBox title="ผู้ส่งเงิน / ผู้จัดทำรายงาน" />
            <SignBox title="ผู้รับเงิน (หัวหน้า)" amountLine />
          </div>
        </section>

      </article>
    </>
  );
}

export default function ReportPage({ searchParams }: PageProps<"/report">) {
  return (
    <>
      <div className="print:hidden">
        <PageHeader title="สรุปรายรับรายวัน" subtitle="เลือกวันที่ จดเงินที่เบิกไปใช้ ตรวจยอด แล้วบันทึกเป็น PDF ส่งให้หัวหน้าเซ็นรับเงิน" />
      </div>
      <Suspense
        fallback={
          <div className="space-y-4">
            <Skeleton className="h-12 w-80" />
            <Skeleton className="mx-auto h-[900px] max-w-[210mm]" />
          </div>
        }
      >
        <ReportData searchParams={searchParams} />
      </Suspense>
    </>
  );
}
