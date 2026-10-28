import { Suspense } from "react";
import { existsSync } from "node:fs";
import path from "node:path";
import { PageHeader } from "@/components/nav";
import { Skeleton } from "@/components/ui";
import { getBikes, getRentals, getSettings } from "@/lib/data";
import { getStore, sheetsConfigured } from "@/lib/store";
import { SettingsClient } from "./settings-client";

export const metadata = { title: "ตั้งค่า" };

async function SettingsData() {
  let error = "";
  let counts = { bikes: 0, rentals: 0 };
  let settings;
  try {
    const [bikes, rentals, s] = await Promise.all([getBikes(), getRentals(), getSettings()]);
    counts = { bikes: bikes.length, rentals: rentals.length };
    settings = s;
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
    settings = await import("@/lib/laundry").then((m) => m.DEFAULT_SETTINGS);
  }
  const sheetId = process.env.GOOGLE_SHEET_ID;
  return (
    <SettingsClient
      settings={settings}
      mode={getStore().kind}
      configured={sheetsConfigured()}
      sheetUrl={sheetId ? `https://docs.google.com/spreadsheets/d/${sheetId}/edit` : ""}
      serviceEmail={process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ?? ""}
      counts={counts}
      hasSeed={existsSync(path.join(process.cwd(), "data", "seed.json"))}
      error={error}
    />
  );
}

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="ตั้งค่า" subtitle="การเชื่อมต่อ Google Sheets ราคาซักผ้า และรายการห้อง" />
      <Suspense fallback={<Skeleton className="h-[600px]" />}>
        <SettingsData />
      </Suspense>
    </>
  );
}
