import { TreePalm } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { ThemeButton } from "@/components/theme";
import { LoginForm } from "./form";

export const metadata = { title: "เข้าสู่ระบบ" };

export default function LoginPage() {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      {/* ภาพเกาะช้าง: เต็มครึ่งจอบนคอม / แบนเนอร์ด้านบนบนมือถือ */}
      <div className="relative h-56 overflow-hidden sm:h-72 lg:h-auto">
        <Image
          src="/illustrations/island.svg"
          alt="ภาพประกอบเกาะช้างยามพระอาทิตย์ตก"
          fill
          priority
          unoptimized
          className="object-cover object-[68%_center] lg:hidden"
        />
        {/* จอคอม: ใช้ภาพแนวตั้ง (มีท้องฟ้าดาวด้านบน) จะได้ไม่ถูกครอปจนเหลือแค่ทะเล */}
        <Image
          src="/illustrations/island-tall.svg"
          alt=""
          fill
          priority
          unoptimized
          className="hidden object-cover object-bottom lg:block"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-indigo-950/70 via-indigo-950/10 to-transparent lg:bg-gradient-to-r lg:from-indigo-950/70 lg:via-indigo-950/20" />
        <div className="absolute bottom-0 left-0 p-6 text-white sm:p-10">
          <p className="text-sm font-medium text-white/80">ยินดีต้อนรับสู่</p>
          <p className="text-2xl font-bold tracking-tight sm:text-4xl">Private Paradise Resort</p>
          <p className="text-white/80">เกาะช้าง · ตราด</p>
        </div>
      </div>

      <div className="relative flex items-center justify-center px-4 py-10 sm:px-8">
        <ThemeButton className="absolute top-4 right-4" />
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3">
            <div className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-brand-2 to-violet-500 text-white shadow-lg shadow-brand/30">
              <TreePalm className="size-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold">เข้าสู่ระบบ</h1>
              <p className="text-sm text-muted">ระบบจัดการเช่ารถ & ซักผ้า</p>
            </div>
          </div>
          <Suspense>
            <LoginForm />
          </Suspense>
          <div className="mt-6 flex items-center justify-center gap-4 text-sm">
            <Link href="/" className="font-medium text-brand hover:underline">
              ดูแดชบอร์ด (ไม่ต้องล็อกอิน)
            </Link>
            <span className="text-line">|</span>
            <Link href="/install" className="text-muted hover:text-ink">
              ติดตั้งแอป
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
