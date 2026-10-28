// แทนที่ข้อมูลรถ + เช่ารถ ใน Google Sheet ด้วย data/seed.json (สร้างจาก Excel ด้วย extract_seed.py)
// ใช้เมื่อต้องการ "ล้างของเดิมแล้วเอาข้อมูลจาก Excel ล่าสุดทับ" — ไม่แตะแท็บ ตั้งค่า / ซักผ้า
//   node --env-file=.env.local scripts/replace-from-seed.mjs
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { JWT } from "google-auth-library";

const client = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
const base = `https://sheets.googleapis.com/v4/spreadsheets/${process.env.GOOGLE_SHEET_ID}`;
const req = (url, method = "GET", data) => client.request({ url: base + url, method, data }).then((r) => r.data);
const range = (sheet, a1) => encodeURIComponent(`'${sheet}'!${a1}`);
const newId = () => randomUUID().replace(/-/g, "").slice(0, 10);
const now = new Date().toISOString();

const seed = JSON.parse(await readFile("data/seed.json", "utf8"));
const meta = await req("?fields=sheets.properties(title,sheetId)");
const sheetId = (t) => meta.sheets.find((s) => s.properties.title === t).properties.sheetId;

async function replace(sheet, toObject) {
  const head = (await req(`/values/${range(sheet, "1:1")}`)).values[0];
  const count = ((await req(`/values/${range(sheet, "A2:A")}`)).values ?? []).length;
  if (count) {
    await req(":batchUpdate", "POST", {
      requests: [{ deleteDimension: { range: { sheetId: sheetId(sheet), dimension: "ROWS", startIndex: 1, endIndex: 1 + count } } }],
    });
  }
  const rows = toObject().map((o) => head.map((h) => o[h] ?? ""));
  await req(`/values/${range(sheet, "A1")}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, "POST", { values: rows });
  console.log(`${sheet}: ลบ ${count} แถวเดิม, ใส่ ${rows.length} แถวใหม่`);
}

const bikeIds = new Map(seed.bikes.map((b) => [b.plate, newId()]));

await replace("รถ", () =>
  seed.bikes.map((b) => ({
    id: bikeIds.get(b.plate),
    ยี่ห้อ: b.brand,
    "รุ่น / ซีซี": b.model,
    ทะเบียน: b.plate,
    จังหวัด: b.province,
    ที่มารถ: b.source,
    ภาษีหมด: b.taxExpiry,
    ชื่อเจ้าของ: b.owner,
    บัตรหมดอายุ: b.cardExpiry,
    ชุดโอนต่อ: b.transferKit,
    พร้อมโอนให้ใคร: b.transferTo,
    สถานะ: b.status,
    "ราคาเช่า/วัน": b.dailyRate,
    หมายเหตุ: "",
    สร้างเมื่อ: now,
  })),
);

await replace("เช่ารถ", () =>
  seed.rentals.map((r) => ({
    id: newId(),
    วันที่: r.date,
    เวลา: r.time,
    bikeId: bikeIds.get(r.plate),
    ทะเบียน: r.plate,
    จำนวนวัน: r.days,
    "ราคา/วัน": r.price,
    ส่วนลด: r.discount,
    ค่าปรับ: r.fine,
    ยอดรวม: r.days * r.price - r.discount + r.fine,
    ลูกค้า: r.customer,
    หมายเหตุ: r.note,
    สร้างเมื่อ: now,
  })),
);
