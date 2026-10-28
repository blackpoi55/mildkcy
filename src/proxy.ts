import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, isValidToken } from "@/lib/auth";

// หน้าที่เปิดดูได้โดยไม่ต้องล็อกอิน (แดชบอร์ดแบบอ่านอย่างเดียว)
const PUBLIC_PATHS = new Set(["/", "/install", "/login"]);

export async function proxy(request: NextRequest) {
  if (PUBLIC_PATHS.has(request.nextUrl.pathname)) return NextResponse.next();
  if (await isValidToken(request.cookies.get(AUTH_COOKIE)?.value)) return NextResponse.next();
  const url = new URL("/login", request.url);
  url.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(url);
}

export const config = {
  // ไม่ตรวจล็อกอินกับไฟล์ static ทุกชนิด (รูป ไอคอน manifest sw.js) — ใช้ได้ทั้งหน้า login และผู้เยี่ยมชม
  matcher: ["/((?!_next/static|_next/image|.*\\.[a-zA-Z0-9]+$).*)"],
};
