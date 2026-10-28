"use client";

import clsx from "clsx";
import { Bike, LayoutDashboard, LogOut, Settings, Shirt, CalendarCheck, TreePalm } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/actions";

const LINKS = [
  { href: "/", label: "แดชบอร์ด", short: "ภาพรวม", icon: LayoutDashboard },
  { href: "/rentals", label: "บันทึกเช่ารถ", short: "เช่ารถ", icon: CalendarCheck },
  { href: "/laundry", label: "ซักผ้า", short: "ซักผ้า", icon: Shirt },
  { href: "/bikes", label: "ทะเบียนรถ", short: "รถ", icon: Bike },
  { href: "/settings", label: "ตั้งค่า", short: "ตั้งค่า", icon: Settings },
];

function useActive() {
  const path = usePathname();
  return (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
}

export function Sidebar({ showLogout }: { showLogout: boolean }) {
  const isActive = useActive();
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-surface px-4 py-6 lg:flex">
      <Link href="/" className="mb-8 flex items-center gap-3 px-2">
        <div className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-brand-2 to-violet-500 text-white shadow-lg shadow-brand/30">
          <TreePalm className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="font-bold leading-tight">Private Paradise</p>
          <p className="text-xs text-muted">Resort · เกาะช้าง</p>
        </div>
      </Link>
      <nav className="flex flex-1 flex-col gap-1">
        {LINKS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={clsx(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
              isActive(href) ? "bg-brand-soft text-brand-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
            )}
          >
            <Icon className="size-[18px]" />
            {label}
          </Link>
        ))}
      </nav>
      {showLogout && (
        <form action={logout}>
          <button className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted hover:bg-surface-2 hover:text-ink">
            <LogOut className="size-[18px]" />
            ออกจากระบบ
          </button>
        </form>
      )}
    </aside>
  );
}

export function BottomNav() {
  const isActive = useActive();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg lg:hidden">
      <div className="mx-auto grid max-w-lg grid-cols-5">
        {LINKS.map(({ href, short, icon: Icon }) => (
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
