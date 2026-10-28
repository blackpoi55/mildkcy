import { PageHeader } from "@/components/nav";
import { InstallGuide } from "./install-guide";

export const metadata = { title: "ติดตั้งแอป" };

export default function InstallPage() {
  return (
    <>
      <PageHeader title="ติดตั้งแอป" subtitle="ใช้งานเหมือนแอปจริง เปิดจากหน้าจอโฮม / Dock / Taskbar ได้ทันที ไม่ต้องโหลดจาก App Store" />
      <InstallGuide />
    </>
  );
}
