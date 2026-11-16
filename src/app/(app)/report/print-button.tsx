"use client";

import { FileDown } from "lucide-react";
import { Button } from "@/components/ui";

/** เปิดหน้าต่างพิมพ์ของเบราว์เซอร์ (เหมือนกด Ctrl+P) — เลือก "บันทึกเป็น PDF" ได้ ชื่อไฟล์มาจากชื่อหน้าเว็บ */
export function PrintButton() {
  return (
    <Button onClick={() => window.print()}>
      <FileDown className="size-4" />
      บันทึก PDF / พิมพ์
    </Button>
  );
}
