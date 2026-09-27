import type { ClassSessionOrigin } from "@prisma/client";

// 給學員看的課程來源標籤（用詞見 docs/context/glossary.md）。
const originLabels: Record<ClassSessionOrigin, string> = {
  organizer_matched: "團主團課",
  teacher_initiated: "老師開課",
};

export function ClassOriginTag({ origin }: { origin: ClassSessionOrigin }) {
  return (
    <span className="rounded-full border border-ink/15 px-3 py-1 text-xs font-medium text-ink-soft">
      {originLabels[origin]}
    </span>
  );
}
