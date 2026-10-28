import type { Metadata, Viewport } from "next";
import { Anuphan } from "next/font/google";
import { RegisterSW } from "@/components/register-sw";
import { ThemedToaster } from "@/components/theme";
import { THEME_COLORS, THEME_SCRIPT } from "@/lib/theme-script";
import "./globals.css";

const thai = Anuphan({
  variable: "--font-thai",
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "Private Paradise Resort เกาะช้าง — ระบบจัดการเช่ารถ & ซักผ้า",
    template: "%s · Private Paradise Resort",
  },
  description: "บันทึกการเช่ามอเตอร์ไซค์ ซักผ้า และดูสรุปรายวัน รายสัปดาห์ รายเดือน",
  applicationName: "Private Paradise Resort",
  appleWebApp: { capable: true, title: "Paradise", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  // iOS รุ่นเก่ายังอ่านแท็กนี้เพื่อเปิดแบบเต็มจอ
  other: { "apple-mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  themeColor: [
    // ค่าเริ่มต้นตามเครื่อง — สคริปต์ธีมจะเปลี่ยนให้ตรงกับที่ผู้ใช้เลือก
    { media: "(prefers-color-scheme: light)", color: THEME_COLORS.light },
    { media: "(prefers-color-scheme: dark)", color: THEME_COLORS.dark },
  ],
  // ให้เนื้อหาเต็มจอบน iPhone (เว้นขอบด้วย safe-area-inset)
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: สคริปต์ธีมใส่ data-theme/style ให้ <html> ก่อน React เข้ามา
    <html lang="th" data-theme="light" className={`${thai.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full font-sans">
        <div aria-hidden className="app-bg pointer-events-none fixed inset-0 -z-10" />
        {children}
        <ThemedToaster />
        <RegisterSW />
      </body>
    </html>
  );
}
