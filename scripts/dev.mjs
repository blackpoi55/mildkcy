// รัน next dev โดยปิดคำเตือน DEP0108 (zlib.bytesRead) ที่มาจากไลบรารีภายนอก
// คำเตือนนี้ไม่มีผลกับการทำงาน แต่ next dev แสดงเป็น "ERROR" สีแดงใน log และ console ทำให้ดูเหมือนเว็บพัง
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const FLAG = "--disable-warning=DEP0108";
const next = createRequire(import.meta.url).resolve("next/dist/bin/next");
// ใส่ใน NODE_OPTIONS ด้วย เพราะ next dev แยก process ลูกไปรันเซิร์ฟเวอร์อีกตัว
const env = { ...process.env, NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} ${FLAG}`.trim() };

const child = spawn(process.execPath, [FLAG, next, "dev", ...process.argv.slice(2)], { stdio: "inherit", env });
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));
child.on("exit", (code) => process.exit(code ?? 0));
