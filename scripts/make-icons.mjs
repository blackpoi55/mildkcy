// สร้างไอคอนแอป (PWA / iOS / favicon) จาก SVG — รันครั้งเดียว: node scripts/make-icons.mjs
import { mkdir } from "node:fs/promises";
import sharp from "sharp";

// เส้นต้นมะพร้าวจาก lucide "tree-palm" (viewBox 24)
const PALM = [
  "M13 8c0-2.76-2.46-5-5.5-5S2 5.24 2 8h2l1-1 1 1h4",
  "M13 7.14A5.82 5.82 0 0 1 16.5 6c3.04 0 5.5 2.24 5.5 5h-3l-1-1-1 1h-3",
  "M5.89 9.71c-2.15 2.15-2.3 5.47-.35 7.43l4.24-4.25.7-.7.71-.71 2.12-2.12c-1.95-1.96-5.27-1.8-7.42.35",
  "M11 15.5c.5 2.5-.17 4.5-1 6.5h4c2-5.5-.5-12-1-14",
];

/** @param {{ radius: number; scale: number }} o radius = มุมโค้งของพื้นหลัง (0 = เต็มกรอบ), scale = ขนาดต้นไม้เทียบกับกรอบ */
function svg({ radius, scale }) {
  const size = 512;
  const icon = size * scale;
  const offset = (size - icon) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#6366f1"/>
      <stop offset="1" stop-color="#8b5cf6"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${radius}" fill="url(#g)"/>
  <circle cx="${size * 0.78}" cy="${size * 0.2}" r="${size * 0.3}" fill="#fff" opacity="0.08"/>
  <g transform="translate(${offset} ${offset}) scale(${icon / 24})" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    ${PALM.map((d) => `<path d="${d}"/>`).join("")}
  </g>
</svg>`;
}

const out = [
  // ไอคอนทั่วไป (มุมโค้ง)
  { file: "public/icons/icon-192.png", size: 192, radius: 112, scale: 0.56 },
  { file: "public/icons/icon-512.png", size: 512, radius: 112, scale: 0.56 },
  // maskable: พื้นหลังเต็มกรอบ ต้นไม้อยู่ใน safe zone 80%
  { file: "public/icons/maskable-512.png", size: 512, radius: 0, scale: 0.46 },
  // iOS ใส่มุมโค้งให้เอง → เต็มกรอบ
  { file: "src/app/apple-icon.png", size: 180, radius: 0, scale: 0.56 },
  { file: "src/app/icon.png", size: 64, radius: 112, scale: 0.62 },
];

await mkdir("public/icons", { recursive: true });
for (const o of out) {
  await sharp(Buffer.from(svg(o))).resize(o.size, o.size).png().toFile(o.file);
  console.log("✓", o.file);
}
