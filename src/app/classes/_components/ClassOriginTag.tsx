import type { ClassSessionOrigin } from "@prisma/client";

// 給學員看的課程來源標籤（用詞見 docs/context/glossary.md）。
const originLabels: Record<ClassSessionOrigin, string> = {
  organizer_matched: "團主團課",
  teacher_initiated: "老師開課",
  // organizer-usability-redesign 票 09：團主直接邀請合作老師開的課，對學員來說同樣是團主團課。
  organizer_direct: "團主團課",
};

export function ClassOriginTag({ origin }: { origin: ClassSessionOrigin }) {
  return (
    <span className="rounded-full border border-ink/15 px-3 py-1 text-xs font-medium text-ink-soft">
      {originLabels[origin]}
    </span>
  );
}
