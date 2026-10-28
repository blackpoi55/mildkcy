"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";
import { Toaster } from "sonner";
import { cn } from "@/components/ui";

export type ThemeChoice = "light" | "dark" | "system";

declare global {
  interface Window {
    __applyTheme?: () => void;
  }
}

const listeners = new Set<() => void>();

function readChoice(): ThemeChoice {
  try {
    const v = localStorage.getItem("theme");
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

function subscribeChoice(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb); // เปลี่ยนจากอีกแท็บ
  // หลัง hydrate ให้ React อ่านค่าจริงจาก localStorage อีกรอบ (ตอน hydrate ใช้ค่าเริ่มต้นจาก server)
  const t = setTimeout(cb, 0);
  return () => {
    clearTimeout(t);
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

/** ธีมที่ผู้ใช้เลือก (สว่าง / มืด / ตามเครื่อง) */
export function useThemeChoice() {
  return useSyncExternalStore(subscribeChoice, readChoice, () => "system" as ThemeChoice);
}

export function setThemeChoice(c: ThemeChoice) {
  try {
    if (c === "system") localStorage.removeItem("theme");
    else localStorage.setItem("theme", c);
  } catch {}
  window.__applyTheme?.();
  listeners.forEach((l) => l());
}

function subscribeResolved(cb: () => void) {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  const t = setTimeout(cb, 0); // อ่านค่าจริงหลัง hydrate
  return () => {
    clearTimeout(t);
    mo.disconnect();
  };
}

/** ธีมที่ใช้อยู่จริงตอนนี้ */
export function useResolvedTheme() {
  return useSyncExternalStore(
    subscribeResolved,
    () => (document.documentElement.dataset.theme === "dark" ? "dark" : "light"),
    () => "light" as const,
  );
}

const OPTIONS: { value: ThemeChoice; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "สว่าง", icon: Sun },
  { value: "dark", label: "มืด", icon: Moon },
  { value: "system", label: "ตามเครื่อง", icon: Monitor },
];

/** ปุ่มเลือกธีม 3 แบบ (ใช้ในเมนูด้านซ้าย / หน้าตั้งค่า) */
export function ThemeSwitch({ className, showLabels }: { className?: string; showLabels?: boolean }) {
  const choice = useThemeChoice();
  return (
    <div className={cn("flex rounded-xl bg-surface-2 p-1", className)} role="radiogroup" aria-label="ธีม">
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          role="radio"
          aria-checked={choice === value}
          title={label}
          onClick={() => setThemeChoice(value)}
          className={cn(
            "flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition",
            choice === value ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink",
          )}
        >
          <Icon className="size-4" />
          {showLabels && label}
        </button>
      ))}
    </div>
  );
}

/** ปุ่มเดียวกดวน สว่าง → มืด → ตามเครื่อง (ใช้บนมือถือ / หน้าเข้าสู่ระบบ) */
export function ThemeButton({ className }: { className?: string }) {
  const choice = useThemeChoice();
  const i = OPTIONS.findIndex((o) => o.value === choice);
  const { icon: Icon, label } = OPTIONS[i];
  const next = OPTIONS[(i + 1) % OPTIONS.length];
  return (
    <button
      onClick={() => setThemeChoice(next.value)}
      aria-label={`ธีม: ${label} (กดเพื่อเปลี่ยนเป็น${next.label})`}
      title={`ธีม: ${label}`}
      className={cn("grid size-9 cursor-pointer place-items-center rounded-xl text-ink-2 hover:bg-surface-2", className)}
    >
      <Icon className="size-[18px]" />
    </button>
  );
}

/** Toast ที่เปลี่ยนสีตามธีม + ซิงก์สีแถบสถานะหลังโหลดหน้า */
export function ThemedToaster() {
  const theme = useResolvedTheme();
  useEffect(() => {
    window.__applyTheme?.();
  }, []);
  return <Toaster position="top-center" richColors closeButton theme={theme} />;
}
