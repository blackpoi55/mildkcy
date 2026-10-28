"use client";

import {
  Apple,
  CheckCircle2,
  Download,
  EllipsisVertical,
  Info,
  Laptop,
  MonitorDown,
  PlusSquare,
  Share,
  Smartphone,
  TreePalm,
} from "lucide-react";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { Button, Card, Segmented } from "@/components/ui";

type Platform = "iphone" | "android" | "windows" | "mac";

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

function detect(): Platform {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1)) return "iphone";
  if (/Android/.test(ua)) return "android";
  if (/Mac/.test(ua)) return "mac";
  return "windows";
}

const subscribeNoop = () => () => {};
function useIsStandalone() {
  return useSyncExternalStore(
    subscribeNoop,
    () =>
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true,
    () => false,
  );
}

function Key({ children }: { children: ReactNode }) {
  return (
    <span className="mx-0.5 inline-flex items-center gap-1 rounded-md border border-line bg-surface-2 px-1.5 py-0.5 align-middle text-xs font-semibold text-ink">
      {children}
    </span>
  );
}

function Steps({ steps }: { steps: ReactNode[] }) {
  return (
    <ol className="space-y-4">
      {steps.map((s, i) => (
        <li key={i} className="flex gap-3">
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-soft text-sm font-bold text-brand-ink">
            {i + 1}
          </span>
          <div className="pt-0.5 text-sm leading-relaxed text-ink-2">{s}</div>
        </li>
      ))}
    </ol>
  );
}

const GUIDES: Record<Platform, { title: string; browser: string; steps: ReactNode[]; note?: ReactNode }> = {
  iphone: {
    title: "iPhone / iPad",
    browser: "ใช้ Safari (iOS 16.4 ขึ้นไปใช้ Chrome ได้ด้วย)",
    steps: [
      <>เปิดเว็บนี้ใน <b>Safari</b></>,
      <>
        แตะปุ่มแชร์ <Key><Share className="size-3.5" /></Key> ที่แถบด้านล่าง (บน iPad อยู่มุมขวาบน)
      </>,
      <>
        เลื่อนลงแล้วแตะ <Key><PlusSquare className="size-3.5" /> เพิ่มไปยังหน้าจอโฮม</Key> (Add to Home Screen)
      </>,
      <>
        เปิด <b>“เปิดเป็นเว็บแอป”</b> ไว้ (ถ้ามี) แล้วแตะ <Key>เพิ่ม</Key> มุมขวาบน
      </>,
      <>ไอคอนต้นมะพร้าวจะอยู่บนหน้าจอโฮม แตะเพื่อเปิดแบบเต็มจอเหมือนแอป</>,
    ],
  },
  android: {
    title: "Android",
    browser: "ใช้ Google Chrome",
    steps: [
      <>เปิดเว็บนี้ใน <b>Chrome</b></>,
      <>
        ถ้ามีปุ่ม <Key><Download className="size-3.5" /> ติดตั้งเลย</Key> ด้านบนของหน้านี้ แตะได้ทันที
      </>,
      <>
        หรือแตะเมนู <Key><EllipsisVertical className="size-3.5" /></Key> มุมขวาบน → <Key>ติดตั้งแอป</Key> (Install app) หรือ{" "}
        <Key>เพิ่มลงในหน้าจอหลัก</Key>
      </>,
      <>แตะ <Key>ติดตั้ง</Key> ไอคอนจะอยู่ในหน้าจอหลักและลิ้นชักแอป</>,
    ],
  },
  windows: {
    title: "คอมพิวเตอร์ Windows",
    browser: "ใช้ Google Chrome หรือ Microsoft Edge",
    steps: [
      <>เปิดเว็บนี้ใน <b>Chrome</b> หรือ <b>Edge</b></>,
      <>
        กดปุ่ม <Key><Download className="size-3.5" /> ติดตั้งเลย</Key> ด้านบน หรือไอคอน <Key><MonitorDown className="size-3.5" /></Key> ทางขวาของช่อง URL
      </>,
      <>
        <b>Chrome:</b> เมนู <Key><EllipsisVertical className="size-3.5" /></Key> → <Key>แคสต์ บันทึก และแชร์</Key> →{" "}
        <Key>ติดตั้งหน้าเว็บเป็นแอป</Key>
      </>,
      <>
        <b>Edge:</b> เมนู <Key>…</Key> → <Key>แอป</Key> → <Key>ติดตั้งไซต์นี้เป็นแอป</Key>
      </>,
      <>แอปจะอยู่ในเมนู Start — คลิกขวาที่ไอคอนบน Taskbar → “ปักหมุด” เพื่อเปิดได้เร็วขึ้น</>,
    ],
  },
  mac: {
    title: "Mac",
    browser: "ใช้ Safari (macOS Sonoma ขึ้นไป) หรือ Chrome",
    steps: [
      <>
        <b>Safari:</b> เปิดเว็บนี้ → เมนู <Key>ไฟล์ (File)</Key> → <Key>เพิ่มไปที่ Dock (Add to Dock)</Key> → <Key>เพิ่ม</Key>
      </>,
      <>
        หรือกดปุ่มแชร์ <Key><Share className="size-3.5" /></Key> บนแถบเครื่องมือ → <Key>เพิ่มไปที่ Dock</Key>
      </>,
      <>
        <b>Chrome:</b> กด <Key><Download className="size-3.5" /> ติดตั้งเลย</Key> ด้านบน หรือไอคอน{" "}
        <Key><MonitorDown className="size-3.5" /></Key> ในช่อง URL
      </>,
      <>แอปจะอยู่ใน Dock และ Launchpad เปิดเป็นหน้าต่างแยกเหมือนแอปทั่วไป</>,
    ],
  },
};

const TABS: { value: Platform; label: ReactNode }[] = [
  { value: "iphone", label: <span className="flex items-center gap-1.5"><Apple className="size-4" />iPhone</span> },
  { value: "android", label: <span className="flex items-center gap-1.5"><Smartphone className="size-4" />Android</span> },
  { value: "windows", label: <span className="flex items-center gap-1.5"><Laptop className="size-4" />Windows</span> },
  { value: "mac", label: <span className="flex items-center gap-1.5"><Laptop className="size-4" />Mac</span> },
];

export function InstallGuide() {
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const standalone = useIsStandalone();

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const detected = useSyncExternalStore(subscribeNoop, detect, () => "iphone" as Platform);
  const current = platform ?? detected;
  const guide = GUIDES[current];

  async function install() {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setPrompt(null);
  }

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-6">
        {standalone || installed ? (
          <Card className="flex items-center gap-3 border-good/30 bg-good-soft p-5 text-good">
            <CheckCircle2 className="size-6 shrink-0" />
            <p className="font-medium">ติดตั้งแอปเรียบร้อยแล้ว เปิดจากไอคอนบนหน้าจอได้เลย</p>
          </Card>
        ) : (
          prompt && (
            <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
              <div>
                <p className="font-semibold">อุปกรณ์นี้ติดตั้งได้ในคลิกเดียว</p>
                <p className="text-sm text-muted">กดปุ่มแล้วเลือก “ติดตั้ง” ในหน้าต่างที่ขึ้นมา</p>
              </div>
              <Button size="lg" onClick={install}>
                <Download className="size-5" /> ติดตั้งเลย
              </Button>
            </Card>
          )
        )}

        <Card className="p-5 sm:p-6">
          <div className="-mx-1 mb-6 overflow-x-auto px-1">
            <Segmented value={current} onChange={setPlatform} options={TABS} />
          </div>
          <h2 className="text-lg font-bold">{guide.title}</h2>
          <p className="mb-5 text-sm text-muted">{guide.browser}</p>
          <Steps steps={guide.steps} />
        </Card>

        <div className="flex gap-3 rounded-2xl border border-line bg-surface p-4 text-sm text-ink-2">
          <Info className="mt-0.5 size-4 shrink-0 text-brand" />
          <p>
            การติดตั้งต้องเปิดผ่านลิงก์ <b>https://</b> (เช่น หลังเอาขึ้น Vercel) — ถ้าเปิดผ่านเลข IP ในวง Wi-Fi เช่น{" "}
            <code>http://192.168…</code> มือถือจะไม่ยอมติดตั้งเป็นแอป ข้อมูลทั้งหมดยังเก็บใน Google Sheets ที่เดิม
            แอปที่ติดตั้งจะอัปเดตเองอัตโนมัติ
          </p>
        </div>
      </div>

      <Card className="hidden p-6 text-center lg:block">
        <div className="mx-auto mb-4 grid size-20 place-items-center rounded-3xl bg-gradient-to-br from-brand-2 to-violet-500 text-white shadow-xl shadow-brand/30">
          <TreePalm className="size-10" />
        </div>
        <p className="font-bold">Private Paradise Resort</p>
        <p className="mb-4 text-sm text-muted">เกาะช้าง</p>
        <ul className="space-y-2 text-left text-sm text-ink-2">
          {["เปิดเต็มจอ ไม่มีแถบเบราว์เซอร์", "ไอคอนบนหน้าจอโฮม / Dock / Taskbar", "อัปเดตอัตโนมัติ ไม่ต้องโหลดใหม่", "ไม่ล็อกอินก็ดูแดชบอร์ดได้"].map((t) => (
            <li key={t} className="flex items-center gap-2">
              <CheckCircle2 className="size-4 shrink-0 text-good" />
              {t}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
