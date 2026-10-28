import { AlertTriangle, CircleCheck, CircleX } from "lucide-react";
import { Badge } from "@/components/ui";
import { thShort } from "@/lib/dates";
import { expiryState } from "@/lib/expiry";

export { expiryState };

export function ExpiryBadge({ date, today, prefix }: { date: string; today: string; prefix?: string }) {
  const s = expiryState(date, today);
  if (!s) return <Badge>{prefix} -</Badge>;
  const Icon = s.tone === "bad" ? CircleX : s.tone === "warn" ? AlertTriangle : CircleCheck;
  return (
    <Badge tone={s.tone} title={thShort(date)}>
      <Icon className="size-3" />
      {prefix} {s.label}
    </Badge>
  );
}

const STATUS_TONE: Record<string, "brand" | "good" | "warn" | "bad" | "neutral"> = {
  เช่า: "brand",
  Resort: "good",
  ซาเล้ง: "neutral",
  ซ่อม: "warn",
  ซากรถ: "bad",
  ขายแล้ว: "neutral",
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={STATUS_TONE[status] ?? "neutral"}>{status || "-"}</Badge>;
}
