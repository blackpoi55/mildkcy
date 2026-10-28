import "server-only";
import { connection } from "next/server";
import { DEFAULT_SETTINGS, type AppSettings } from "./laundry";
import { getStore } from "./store";

export type { AppSettings, LaundryPrice } from "./laundry";

export async function getBikes() {
  await connection();
  const bikes = await getStore().all("bikes");
  return bikes.sort((a, b) => a.plate.localeCompare(b.plate, "th"));
}

export async function getRentals() {
  await connection();
  return getStore().all("rentals");
}

export async function getLaundry() {
  await connection();
  return getStore().all("laundry");
}

export async function getSettings(): Promise<AppSettings> {
  await connection();
  const rows = await getStore().all("settings");
  const map = new Map(rows.map((r) => [r.id, r.value]));
  const s = { ...DEFAULT_SETTINGS };
  const rate = parseFloat(map.get("laundryRate") ?? "");
  if (Number.isFinite(rate)) s.laundryRate = rate;
  try {
    const prices = JSON.parse(map.get("laundryPrices") ?? "null");
    if (Array.isArray(prices) && prices.length) s.laundryPrices = prices;
  } catch {}
  const rooms = (map.get("rooms") ?? "")
    .split(",")
    .map((r) => r.trim())
    .filter(Boolean);
  if (rooms.length) s.rooms = rooms;
  return s;
}
