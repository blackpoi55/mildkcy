// สร้างภาพพื้นหลังเบลอจากภาพเกาะช้าง — รันครั้งเดียว: node scripts/make-backgrounds.mjs
// เบลอไว้ล่วงหน้าเป็นไฟล์เล็ก ๆ จะได้ไม่ต้องใช้ CSS blur ตอนแสดงผล (มือถือไม่หน่วง)
import { mkdir } from "node:fs/promises";
import sharp from "sharp";

await mkdir("public/bg", { recursive: true });

const jobs = [
  { src: "public/illustrations/island.svg", out: "public/bg/island-blur.webp", w: 1600, h: 900 },
  { src: "public/illustrations/island-tall.svg", out: "public/bg/island-blur-tall.webp", w: 900, h: 1600 },
];

for (const j of jobs) {
  await sharp(j.src, { density: 72 })
    .resize(j.w, j.h, { fit: "cover", position: "centre" })
    .blur(48)
    .modulate({ saturation: 1.15 })
    .webp({ quality: 70 })
    .toFile(j.out);
  console.log("✓", j.out);
}
