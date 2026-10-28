import { FlaskConical } from "lucide-react";
import Link from "next/link";
import { BottomNav, Sidebar } from "@/components/nav";
import { authEnabled } from "@/lib/auth";
import { sheetsConfigured } from "@/lib/store";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh">
      <Sidebar showLogout={authEnabled()} />
      <div className="min-w-0 flex-1">
        {!sheetsConfigured() && (
          <Link
            href="/settings"
            className="flex items-center justify-center gap-2 bg-warn-soft px-4 py-2 text-center text-xs font-medium text-warn sm:text-sm"
          >
            <FlaskConical className="size-4 shrink-0" />
            โหมดทดลอง: ข้อมูลถูกเก็บในเครื่อง ยังไม่ได้เชื่อม Google Sheets — กดเพื่อดูวิธีตั้งค่า
          </Link>
        )}
        <main className="mx-auto w-full max-w-7xl px-4 pt-6 pb-28 sm:px-6 lg:px-8 lg:pt-8 lg:pb-12">{children}</main>
      </div>
      <BottomNav />
    </div>
  );
}
