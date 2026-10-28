import type { Metadata, Viewport } from "next";
import { Anuphan } from "next/font/google";
import { Toaster } from "sonner";
import { RegisterSW } from "@/components/register-sw";
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
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#161920" },
  ],
  // ให้เนื้อหาเต็มจอบน iPhone (เว้นขอบด้วย safe-area-inset)
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className={`${thai.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">
        <div aria-hidden className="app-bg pointer-events-none fixed inset-0 -z-10" />
        {children}
        <Toaster position="top-center" richColors closeButton />
        <RegisterSW />
      </body>
    </html>
  );
}
