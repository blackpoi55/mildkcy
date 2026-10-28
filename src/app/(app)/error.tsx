"use client";

import { RefreshCw, TriangleAlert } from "lucide-react";
import { useEffect } from "react";
import { Button, Card } from "@/components/ui";

// หน้าแสดงเมื่อโหลดข้อมูลไม่สำเร็จ (ส่วนใหญ่คือ Google Sheets ถูกเรียกถี่เกินโควตา หรือเน็ตหลุด)
export default function AppError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Card className="mx-auto mt-10 max-w-md p-8 text-center">
      <div className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-warn-soft text-warn">
        <TriangleAlert className="size-7" />
      </div>
      <h2 className="text-lg font-bold">โหลดข้อมูลไม่สำเร็จ</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        อาจเป็นเพราะ Google Sheets ถูกเรียกใช้ถี่เกินไปชั่วคราว หรืออินเทอร์เน็ตไม่เสถียร
        รอสักครู่ (ประมาณ 1 นาที) แล้วกดลองใหม่ ข้อมูลในชีตไม่ได้หายไปไหน
      </p>
      <Button className="mt-6" onClick={() => retry()}>
        <RefreshCw className="size-4" /> ลองใหม่
      </Button>
    </Card>
  );
}
