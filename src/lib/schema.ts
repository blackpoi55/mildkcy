// โครงสร้างตาราง: แต่ละตาราง = 1 แท็บใน Google Sheet แถวแรกเป็นหัวคอลัมน์ภาษาไทย

export type Column = { key: string; label: string; type?: "number" | "boolean" | "date" };

export const TABLES = {
  bikes: {
    sheet: "รถ",
    columns: [
      { key: "id", label: "id" },
      { key: "brand", label: "ยี่ห้อ" },
      { key: "model", label: "รุ่น / ซีซี" },
      { key: "plate", label: "ทะเบียน" },
      { key: "province", label: "จังหวัด" },
      { key: "source", label: "ที่มารถ" },
      { key: "taxExpiry", label: "ภาษีหมด", type: "date" },
      { key: "owner", label: "ชื่อเจ้าของ" },
      { key: "cardExpiry", label: "บัตรหมดอายุ", type: "date" },
      { key: "transferKit", label: "ชุดโอนต่อ" },
      { key: "transferTo", label: "พร้อมโอนให้ใคร" },
      { key: "status", label: "สถานะ" },
      { key: "dailyRate", label: "ราคาเช่า/วัน", type: "number" },
      { key: "note", label: "หมายเหตุ" },
      { key: "createdAt", label: "สร้างเมื่อ" },
    ],
  },
  rentals: {
    sheet: "เช่ารถ",
    columns: [
      { key: "id", label: "id" },
      { key: "date", label: "วันที่", type: "date" },
      { key: "time", label: "เวลา" },
      { key: "bikeId", label: "bikeId" },
      { key: "plate", label: "ทะเบียน" },
      { key: "days", label: "จำนวนวัน", type: "number" },
      { key: "price", label: "ราคา/วัน", type: "number" },
      { key: "discount", label: "ส่วนลด", type: "number" },
      { key: "fine", label: "ค่าปรับ", type: "number" },
      { key: "total", label: "ยอดรวม", type: "number" },
      { key: "customer", label: "ลูกค้า" },
      { key: "note", label: "หมายเหตุ" },
      { key: "createdAt", label: "สร้างเมื่อ" },
    ],
  },
  laundry: {
    sheet: "ซักผ้า",
    columns: [
      { key: "id", label: "id" },
      { key: "date", label: "วันที่", type: "date" },
      { key: "time", label: "เวลา" },
      { key: "room", label: "ห้อง" },
      { key: "kg", label: "น้ำหนัก (กก.)", type: "number" },
      { key: "price", label: "ราคา", type: "number" },
      { key: "paid", label: "ชำระแล้ว", type: "boolean" },
      { key: "note", label: "หมายเหตุ" },
      { key: "createdAt", label: "สร้างเมื่อ" },
    ],
  },
  settings: {
    sheet: "ตั้งค่า",
    columns: [
      { key: "id", label: "key" },
      { key: "value", label: "value" },
    ],
  },
} as const satisfies Record<string, { sheet: string; columns: readonly Column[] }>;

export type TableName = keyof typeof TABLES;

export type Bike = {
  id: string;
  brand: string;
  model: string;
  plate: string;
  province: string;
  source: string;
  taxExpiry: string;
  owner: string;
  cardExpiry: string;
  transferKit: string;
  transferTo: string;
  status: string;
  dailyRate: number;
  note: string;
  createdAt: string;
};

export type Rental = {
  id: string;
  date: string;
  time: string;
  bikeId: string;
  plate: string;
  days: number;
  price: number;
  discount: number;
  fine: number;
  total: number;
  customer: string;
  note: string;
  createdAt: string;
};

export type Laundry = {
  id: string;
  date: string;
  time: string;
  room: string;
  kg: number;
  price: number;
  paid: boolean;
  note: string;
  createdAt: string;
};

export type Setting = { id: string; value: string };

export type RowOf<T extends TableName> = T extends "bikes"
  ? Bike
  : T extends "rentals"
    ? Rental
    : T extends "laundry"
      ? Laundry
      : Setting;

export const BIKE_STATUSES = ["เช่า", "Resort", "ซาเล้ง", "ซ่อม", "ซากรถ", "ขายแล้ว"] as const;
/** สถานะที่นับว่าเป็นรถพร้อมให้เช่า (ใช้คำนวณอัตราการใช้รถ) */
export const RENTABLE_STATUS = "เช่า";

export function rentalTotal(r: Pick<Rental, "days" | "price" | "discount" | "fine">) {
  return r.days * r.price - r.discount + r.fine;
}
