import { FlaskConical } from "lucide-react";
import Link from "next/link";
import { Suspense, type ComponentType } from "react";
import { BottomNav, MobileTopBar, Sidebar, type NavProps } from "@/components/nav";
import { authEnabled } from "@/lib/auth";
import { isAuthed } from "@/lib/session";
import { sheetsConfigured } from "@/lib/store";

/** อ่านสถานะล็อกอิน (ต้องอยู่ใน Suspense เพราะอ่าน cookie) แล้วส่งให้เมนู */
function WithAuth({ Nav }: { Nav: ComponentType<NavProps> }) {
  return (
    <Suspense fallback={<Nav authed={null} canLogout={false} />}>
      <ResolvedNav Nav={Nav} />
    </Suspense>
  );
}

async function ResolvedNav({ Nav }: { Nav: ComponentType<NavProps> }) {
  return <Nav authed={await isAuthed()} canLogout={authEnabled()} />;
}

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh">
      <WithAuth Nav={Sidebar} />
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
        <WithAuth Nav={MobileTopBar} />
        <main className="mx-auto w-full max-w-7xl px-4 pt-6 pb-28 sm:px-6 lg:px-8 lg:pt-8 lg:pb-12">{children}</main>
      </div>
      <WithAuth Nav={BottomNav} />
    </div>
  );
}
