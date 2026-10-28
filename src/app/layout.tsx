import type { Metadata, Viewport } from "next";
import { Anuphan } from "next/font/google";
import { Toaster } from "sonner";
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
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f6f8" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0f14" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className={`${thai.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">
        {children}
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
