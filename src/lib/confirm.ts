"use client";

import Swal from "sweetalert2";

/** กล่องยืนยันแบบ SweetAlert2 ปรับสีให้เข้ากับธีมของแอป (รองรับโหมดมืด) */
export async function confirmDialog({
  title,
  html,
  confirmText = "ยืนยัน",
  cancelText = "ยกเลิก",
  danger = false,
}: {
  title: string;
  html?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}) {
  const res = await Swal.fire({
    // ถ้าเปิดจากในหน้าต่างแก้ไข (<dialog> ซึ่งอยู่ชั้นบนสุด) ต้องแสดงในนั้น ไม่งั้นจะถูกบัง
    target: document.querySelector<HTMLElement>("dialog[open]") ?? "body",
    title,
    html,
    icon: danger ? "warning" : "question",
    theme: "auto",
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
    reverseButtons: true,
    focusCancel: true,
    buttonsStyling: false,
    customClass: {
      popup: "app-swal",
      actions: "gap-2",
      confirmButton: `cursor-pointer rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm ${
        danger ? "bg-bad hover:opacity-90" : "bg-brand-2 hover:bg-brand"
      }`,
      cancelButton:
        "cursor-pointer rounded-xl border border-line bg-surface px-5 py-2.5 text-sm font-medium text-ink hover:bg-surface-2",
    },
  });
  return res.isConfirmed;
}
