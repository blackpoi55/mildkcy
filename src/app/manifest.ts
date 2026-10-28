import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Private Paradise Resort เกาะช้าง",
    short_name: "Paradise",
    description: "บันทึกการเช่ามอเตอร์ไซค์ ซักผ้า และดูสรุปรายวัน รายสัปดาห์ รายเดือน",
    lang: "th",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#0d0f14",
    theme_color: "#6366f1",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "บันทึกเช่ารถ", url: "/rentals", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "ซักผ้า", url: "/laundry", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
