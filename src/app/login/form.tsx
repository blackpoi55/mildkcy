"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { login } from "@/app/actions";
import { Button, Input } from "@/components/ui";

export function LoginForm() {
  const [error, action, pending] = useActionState(login, null);
  const next = useSearchParams().get("next") ?? "/";
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="next" value={next} />
      <Input name="password" type="password" placeholder="รหัสผ่าน" autoFocus required className="h-12 text-base" />
      {error && <p className="text-sm text-bad">{error}</p>}
      <Button size="lg" className="w-full" disabled={pending}>
        {pending ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
      </Button>
    </form>
  );
}
