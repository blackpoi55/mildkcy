"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import type { Result } from "@/app/actions";

/** เรียก server action พร้อมแสดงผลสำเร็จ/ผิดพลาดเป็น toast */
export function useAction() {
  const [pending, start] = useTransition();
  function run<T>(fn: () => Promise<Result<T>>, success?: string, after?: (data?: T) => void) {
    start(async () => {
      const res = await fn();
      if (res.ok) {
        if (success) toast.success(success);
        after?.(res.data);
      } else {
        toast.error(res.error);
      }
    });
  }
  return { pending, run };
}
