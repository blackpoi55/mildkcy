import Image from "next/image";
import type { ReactNode } from "react";

/** แบนเนอร์ภาพเกาะช้างยามเย็นบนแดชบอร์ด */
export function ResortHero({
  greeting,
  dateLabel,
  stats,
}: {
  greeting: string;
  dateLabel: string;
  stats: { icon: ReactNode; label: string; value: string }[];
}) {
  return (
    <section className="relative mb-8 overflow-hidden rounded-3xl shadow-xl shadow-brand/10">
      <Image
        src="/illustrations/island.svg"
        alt="ภาพประกอบเกาะช้างยามพระอาทิตย์ตก"
        fill
        priority
        unoptimized
        className="object-cover object-[72%_center]"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-indigo-950/85 via-indigo-950/45 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-indigo-950/50 to-transparent" />
      <div className="relative flex min-h-52 flex-col justify-between gap-6 p-6 text-white sm:min-h-60 sm:p-8">
        <div>
          <p className="text-sm font-medium text-white/80">{greeting}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight drop-shadow-sm sm:text-4xl">Private Paradise Resort</h1>
          <p className="mt-1 text-sm text-white/80 sm:text-base">เกาะช้าง · {dateLabel}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {stats.map((s) => (
            <div
              key={s.label}
              className="flex items-center gap-2.5 rounded-2xl border border-white/20 bg-white/15 px-3.5 py-2 backdrop-blur-md"
            >
              <span className="text-white/90">{s.icon}</span>
              <div className="leading-tight">
                <p className="text-[11px] text-white/75">{s.label}</p>
                <p className="tabular text-sm font-semibold">{s.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** หัวหน้าเพจแบบมีภาพประกอบ */
export function IllustratedHeader({
  title,
  subtitle,
  image,
  flip,
  children,
}: {
  title: string;
  subtitle?: string;
  image: string;
  flip?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="relative mb-6 flex items-center justify-between gap-4 overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-brand-soft via-surface to-surface px-5 py-5 sm:px-7 sm:py-6">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        {children && <div className="mt-4 flex flex-wrap items-center gap-2">{children}</div>}
      </div>
      <Image
        src={image}
        alt=""
        width={320}
        height={220}
        unoptimized
        priority
        className={`h-24 w-auto max-w-[40%] shrink-0 object-contain sm:h-32 lg:h-36 ${flip ? "-scale-x-100" : ""}`}
      />
    </div>
  );
}
