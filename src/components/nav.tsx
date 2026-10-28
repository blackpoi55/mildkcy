"use client";

import clsx from "clsx";
import { Bike, CalendarCheck, ClipboardList, Download, LayoutDashboard, LogIn, LogOut, Settings, Shirt, TreePalm } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/actions";
import { ThemeButton, ThemeSwitch } from "@/components/theme";

const MEMBER_LINKS = [
  { href: "/", label: "แดชบอร์ด", short: "ภาพรวม", icon: LayoutDashboard },
  { href: "/rentals", label: "บันทึกเช่ารถ", short: "เช่ารถ", icon: CalendarCheck },
  { href: "/laundry", label: "ซักผ้า", short: "ซักผ้า", icon: Shirt },
  { href: "/records", label: "รายการทั้งหมด", short: "รายการ", icon: ClipboardList },
  { href: "/bikes", label: "ทะเบียนรถ", short: "รถ", icon: Bike },
  { href: "/settings", label: "ตั้งค่า", short: "ตั้งค่า", icon: Settings },
];
/** แถบล่างบนมือถือมีที่ 5 ปุ่ม — ตั้งค่าย้ายไปเป็นไอคอนเฟืองที่แถบบน */
const MOBILE_HIDDEN = new Set(["/settings"]);

// ผู้ที่ยังไม่ล็อกอินเห็นแค่แดชบอร์ด (อ่านอย่างเดียว)
const GUEST_LINKS = [
  { href: "/", label: "แดชบอร์ด", short: "ภาพรวม", icon: LayoutDashboard },
  { href: "/install", label: "ติดตั้งแอป", short: "ติดตั้งแอป", icon: Download },
  { href: "/login", label: "เข้าสู่ระบบ", short: "เข้าสู่ระบบ", icon: LogIn },
];

/** authed: true = ล็อกอินแล้ว, false = ผู้เยี่ยมชม, null = กำลังโหลด */
export type NavProps = { authed: boolean | null; canLogout: boolean };

function linksFor(authed: boolean | null) {
  if (authed) return MEMBER_LINKS;
  if (authed === false) return GUEST_LINKS;
  return MEMBER_LINKS.slice(0, 1);
}

function useActive() {
  const path = usePathname();
  return (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
}

function Logo({ size = "md" }: { size?: "sm" | "md" }) {
  return (
    <span
      className={clsx(
        "grid shrink-0 place-items-center bg-gradient-to-br from-brand-2 to-violet-500 text-white shadow-lg shadow-brand/30",
        size === "md" ? "size-10 rounded-xl" : "size-8 rounded-lg",
      )}
    >
      <TreePalm className={size === "md" ? "size-5" : "size-4"} />
    </span>
  );
}

export function Sidebar({ authed, canLogout }: NavProps) {
  const isActive = useActive();
  const item = (active: boolean) =>
    clsx(
      "flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
      active ? "bg-brand-soft text-brand-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
    );
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-surface/80 px-4 py-6 backdrop-blur-xl lg:flex">
      <Link href="/" className="mb-8 flex items-center gap-3 px-2">
        <Logo />
        <div className="min-w-0">
          <p className="font-bold leading-tight">Private Paradise</p>
          <p className="text-xs text-muted">Resort · เกาะช้าง</p>
        </div>
      </Link>
      <nav className="flex flex-1 flex-col gap-1">
        {linksFor(authed).map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className={item(isActive(href))}>
            <Icon className="size-[18px]" />
            {label}
          </Link>
        ))}
      </nav>
      <ThemeSwitch className="mb-3" />
      {authed && (
        <div className="flex flex-col gap-1 border-t border-line pt-3">
          <Link href="/install" className={item(isActive("/install"))}>
            <Download className="size-[18px]" />
            ติดตั้งแอป
          </Link>
          {canLogout && (
            <form action={logout}>
              <button className={item(false)}>
                <LogOut className="size-[18px]" />
                ออกจากระบบ
              </button>
            </form>
          )}
        </div>
      )}
    </aside>
  );
}

/** แถบด้านบนสำหรับมือถือ: ชื่อรีสอร์ต + ปุ่มติดตั้ง / เข้าสู่ระบบ / ออกจากระบบ */
export function MobileTopBar({ authed, canLogout }: NavProps) {
  const icon = "grid size-9 place-items-center rounded-xl text-ink-2 hover:bg-surface-2";
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/90 pt-[env(safe-area-inset-top)] backdrop-blur-lg lg:hidden">
      <div className="flex items-center gap-2.5 px-4 py-2.5">
        <Link href="/" className="flex min-w-0 flex-1 items-center gap-2.5">
          <Logo size="sm" />
          <span className="truncate text-sm font-bold">
            Private Paradise<span className="max-sm:hidden"> Resort</span>
          </span>
          <span className="shrink-0 text-xs text-muted max-sm:hidden">เกาะช้าง</span>
        </Link>
        <ThemeButton />
        {authed && (
          <Link href="/settings" className={icon} aria-label="ตั้งค่า">
            <Settings className="size-[18px]" />
          </Link>
        )}
        {authed && (
          <Link href="/install" className={icon} aria-label="ติดตั้งแอป">
            <Download className="size-[18px]" />
          </Link>
        )}
        {authed && canLogout && (
          <form action={logout}>
            <button className={clsx(icon, "cursor-pointer")} aria-label="ออกจากระบบ">
              <LogOut className="size-[18px]" />
            </button>
          </form>
        )}
        {authed === false && (
          <Link href="/login" className="rounded-xl bg-brand-2 px-3 py-1.5 text-sm font-medium text-white">
            เข้าสู่ระบบ
          </Link>
        )}
      </div>
    </header>
  );
}

export function BottomNav({ authed }: NavProps) {
  const isActive = useActive();
  const links = linksFor(authed).filter((l) => !MOBILE_HIDDEN.has(l.href));
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg lg:hidden">
      <div className="mx-auto grid max-w-lg" style={{ gridTemplateColumns: `repeat(${links.length}, minmax(0, 1fr))` }}>
        {links.map(({ href, short, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={clsx(
              "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition",
              isActive(href) ? "text-brand" : "text-muted",
            )}
          >
            <Icon className="size-5" />
            {short}
          </Link>
        ))}
      </div>
    </nav>
  );
}

export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}
