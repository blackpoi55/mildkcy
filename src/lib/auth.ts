// รหัสผ่านเข้าใช้งานแบบง่าย (ตั้งใน APP_PASSWORD) — ถ้าไม่ตั้งจะเปิดใช้งานได้เลย
// ไฟล์นี้ถูกใช้ทั้งใน proxy.ts และ server actions จึงใช้แค่ Web Crypto

export const AUTH_COOKIE = "mk_auth";

export function authEnabled() {
  return !!process.env.APP_PASSWORD;
}

export async function authToken(password = process.env.APP_PASSWORD ?? "") {
  const data = new TextEncoder().encode(`mildkcy:${password}:${process.env.GOOGLE_SHEET_ID ?? ""}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function isValidToken(token: string | undefined) {
  if (!authEnabled()) return true;
  return !!token && token === (await authToken());
}
