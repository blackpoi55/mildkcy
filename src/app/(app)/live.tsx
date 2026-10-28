"use client";

import { useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";

const REFRESH_MS = 15_000;

/**
 * ดึงข้อมูลใหม่จากเซิร์ฟเวอร์ทุก 15 วินาที (และทันทีเมื่อกลับมาที่แอป)
 * ข้ามรอบที่ผู้ใช้กำลังพิมพ์หรือเปิดหน้าต่างแก้ไขอยู่ จะได้ไม่รบกวน
 */
export function AutoRefresh() {
  const router = useRouter();
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState !== "visible" || !navigator.onLine) return;
      if (document.querySelector("dialog[open], .swal2-container")) return;
      const el = document.activeElement;
      if (el && ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)) return;
      router.refresh();
    };
    const id = setInterval(tick, REFRESH_MS);
    const onBack = () => document.visibilityState === "visible" && tick();
    document.addEventListener("visibilitychange", onBack);
    window.addEventListener("online", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onBack);
      window.removeEventListener("online", tick);
    };
  }, [router]);
  return null;
}

function subscribeOnline(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

/** ป้ายสถานะ "สด" + เวลาที่ดึงข้อมูลล่าสุด */
export function LiveBadge({ updatedAt }: { updatedAt: string }) {
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-ink-2">
      <span className="relative flex size-2.5">
        {online && <span className="absolute inline-flex size-full animate-ping rounded-full bg-good opacity-60" />}
        <span className={`relative inline-flex size-2.5 rounded-full ${online ? "bg-good" : "bg-muted"}`} />
      </span>
      {online ? "อัปเดตอัตโนมัติ" : "ออฟไลน์"} · ล่าสุด <span className="tabular font-medium text-ink">{updatedAt}</span>
    </span>
  );
}
