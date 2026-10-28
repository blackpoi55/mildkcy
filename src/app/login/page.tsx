import { Bike } from "lucide-react";
import { Suspense } from "react";
import { LoginForm } from "./form";

export const metadata = { title: "เข้าสู่ระบบ" };

export default function LoginPage() {
  return (
    <div className="grid min-h-dvh place-items-center bg-gradient-to-br from-brand-soft via-bg to-bg px-4">
      <div className="w-full max-w-sm rounded-3xl border border-line bg-surface p-8 shadow-xl shadow-brand/5">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-2 to-violet-500 text-white shadow-lg shadow-brand/30">
            <Bike className="size-7" />
          </div>
          <h1 className="text-xl font-bold">Mildkcy</h1>
          <p className="text-sm text-muted">ระบบจัดการเช่ารถ & ซักผ้า</p>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
