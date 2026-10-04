import type { ClassAvailability } from "@/domain/class-session/availability";

const stateStyles: Record<ClassAvailability["state"], { label: string; className: string }> = {
  open: { label: "開放報名", className: "bg-pine-tint text-pine" },
  full: { label: "已額滿", className: "bg-amber-50 text-amber-800" },
  started: { label: "已開始", className: "bg-ink/5 text-ink-soft" },
};

// 課程的報名狀態與剩餘名額。詳情頁與課程列表共用，文案只在這裡定義。
export function ClassAvailabilityBadge({ availability, canAcceptNewEnrollments }: { availability: ClassAvailability; canAcceptNewEnrollments?: boolean }) {
  const blocked = availability.state === "open" && canAcceptNewEnrollments === false;
  const { label, className } = blocked ? { label: "目前不開放報名", className: "bg-ink/5 text-ink-soft" } : stateStyles[availability.state];

  return (
    <span className="flex flex-wrap items-center gap-2 text-xs font-medium">
      <span className={`rounded-full px-3 py-1 ${className}`}>{label}</span>
      {availability.state === "open" && !blocked ? (
        <span className="text-ink-soft">剩 {availability.remainingSeats} 個名額</span>
      ) : null}
    </span>
  );
}
