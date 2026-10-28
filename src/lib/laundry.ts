// ใช้ได้ทั้งฝั่ง server และ client

export type LaundryPrice = { kg: number; price: number };

export type AppSettings = {
  laundryRate: number;
  laundryPrices: LaundryPrice[];
  rooms: string[];
};

export const DEFAULT_ROOMS = Array.from({ length: 16 }, (_, i) => String(i + 1)).filter((r) => r !== "13");

/** ตารางราคาครึ่งกิโล 0.5 – maxKg คำนวณจากราคาต่อ กก. */
export function buildPriceTable(rate: number, maxKg = 10): LaundryPrice[] {
  return Array.from({ length: maxKg * 2 }, (_, i) => {
    const kg = (i + 1) / 2;
    return { kg, price: Math.round(kg * rate) };
  });
}

export const DEFAULT_SETTINGS: AppSettings = {
  laundryRate: 30,
  laundryPrices: buildPriceTable(30),
  rooms: DEFAULT_ROOMS,
};

/** ราคาตามน้ำหนัก: ใช้ตารางราคาก่อน ถ้าไม่มีน้ำหนักนั้นใช้ราคาต่อ กก. */
export function laundryPriceFor(settings: AppSettings, kg: number) {
  const hit = settings.laundryPrices.find((p) => p.kg === kg);
  return hit ? hit.price : Math.round(kg * settings.laundryRate);
}
