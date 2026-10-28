"use client";

import Swal, { type SweetAlertOptions } from "sweetalert2";

const BTN = "cursor-pointer rounded-xl px-5 py-2.5 text-sm font-semibold shadow-sm";

function base(): SweetAlertOptions {
  return {
    // ถ้าเปิดจากในหน้าต่างแก้ไข (<dialog> ซึ่งอยู่ชั้นบนสุด) ต้องแสดงในนั้น ไม่งั้นจะถูกบัง
    target: document.querySelector<HTMLElement>("dialog[open]") ?? "body",
    theme: document.documentElement.dataset.theme === "dark" ? "dark" : "light",
    reverseButtons: true,
    focusCancel: true,
    // ไม่ปิดเมื่อคลิกนอกกล่อง กันเผลอปิด
    allowOutsideClick: false,
    buttonsStyling: false,
  };
}

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
    ...base(),
    title,
    html,
    icon: danger ? "warning" : "question",
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
    customClass: {
      popup: "app-swal",
      actions: "gap-2",
      confirmButton: `${BTN} text-white ${danger ? "bg-bad hover:opacity-90" : "bg-brand-2 hover:bg-brand"}`,
      cancelButton: `${BTN} border border-line bg-surface font-medium text-ink shadow-none hover:bg-surface-2`,
    },
  });
  return res.isConfirmed;
}

/** กล่องถาม 2 ทางเลือก + ยกเลิก — คืนค่า "confirm" | "deny" | "cancel" */
export async function askDialog({
  title,
  html,
  confirmText,
  denyText,
  cancelText = "ยกเลิก",
}: {
  title: string;
  html?: string;
  confirmText: string;
  denyText: string;
  cancelText?: string;
}) {
  const res = await Swal.fire({
    ...base(),
    title,
    html,
    icon: "question",
    showDenyButton: true,
    showCancelButton: true,
    confirmButtonText: confirmText,
    denyButtonText: denyText,
    cancelButtonText: cancelText,
    customClass: {
      popup: "app-swal",
      actions: "gap-2 flex-wrap",
      confirmButton: `${BTN} bg-brand-2 text-white hover:bg-brand`,
      denyButton: `${BTN} border border-brand/40 bg-brand-soft text-brand-ink shadow-none`,
      cancelButton: `${BTN} border border-line bg-surface font-medium text-ink shadow-none hover:bg-surface-2`,
    },
  });
  return res.isConfirmed ? "confirm" : res.isDenied ? "deny" : "cancel";
}
