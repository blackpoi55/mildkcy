import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { AUTH_COOKIE, isValidToken } from "./auth";

/** ผู้ใช้ล็อกอินแล้วหรือยัง (ถ้าไม่ได้ตั้ง APP_PASSWORD ถือว่าล็อกอินเสมอ) */
export const isAuthed = cache(async () => isValidToken((await cookies()).get(AUTH_COOKIE)?.value));
