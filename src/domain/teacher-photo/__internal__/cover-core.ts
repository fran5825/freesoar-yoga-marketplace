// __internal__：不是通用 API。給 teacher-photo/service.ts（auth 外層）與 Playwright 測試直接呼叫，
// 不做身分判斷，呼叫端必須已確認 teacherProfileId 是目前登入的老師本人。
//
// teacher-showcase-photos 票 04（spec S2、S3、6.3、M2）：課程封面。
// - 封面只能是授課老師自己的「有效」照片（status = active）；
// - 不屬於任何系列的單堂課：封面存在場次自己身上；
// - 系列場次一律用系列的封面：對系列場次設定封面，實際上是設定整個系列的封面（資料庫 check 也保證
//   系列場次自己的 coverPhotoId 永遠是空）；
// - 照片被刪除或下架時，引用它的封面由外鍵自動回到空（畫面顯示品牌色塊），課程本身不受影響。

import { prisma } from "@/lib/prisma";

export type CoverTarget = { kind: "session"; id: string } | { kind: "series"; id: string };

export type SetCoverResult =
  | { ok: true }
  | { ok: false; code: "target_not_found" | "cover_photo_invalid" | "cover_failed" };

export async function setCoverCore(
  teacherProfileId: string,
  target: CoverTarget,
  photoId: string | null,
): Promise<SetCoverResult> {
  try {
    return await prisma.$transaction(async (tx): Promise<SetCoverResult> => {
      let seriesId: string | null = null;
      let sessionId: string | null = null;

      if (target.kind === "series") {
        const series = await tx.recurringClassSeries.findFirst({
          where: { id: target.id, teacherProfileId },
          select: { id: true },
        });

        seriesId = series?.id ?? null;
      } else {
        const session = await tx.classSession.findFirst({
          where: { id: target.id, teacherProfileId },
          select: { id: true, recurringClassSeriesId: true },
        });

        if (session?.recurringClassSeriesId) {
          // 系列場次：封面屬於整個系列。
          seriesId = session.recurringClassSeriesId;
        } else {
          sessionId = session?.id ?? null;
        }
      }

      if (!seriesId && !sessionId) {
        return { ok: false, code: "target_not_found" };
      }

      if (photoId !== null) {
        const photo = await tx.teacherPhoto.findFirst({
          where: { id: photoId, teacherProfileId, status: "active" },
          select: { id: true },
        });

        if (!photo) {
          return { ok: false, code: "cover_photo_invalid" };
        }
      }

      if (seriesId) {
        await tx.recurringClassSeries.update({ where: { id: seriesId }, data: { coverPhotoId: photoId } });
      } else if (sessionId) {
        await tx.classSession.update({ where: { id: sessionId }, data: { coverPhotoId: photoId } });
      }

      return { ok: true };
    });
  } catch (error) {
    // 檢查之後、寫入之前照片剛好被刪：外鍵擋下，視為照片無效。
    if (typeof error === "object" && error !== null && (error as { code?: string }).code === "P2003") {
      return { ok: false, code: "cover_photo_invalid" };
    }

    console.error("[teacher-photo] set cover failed", error);

    return { ok: false, code: "cover_failed" };
  }
}

// 每張照片目前被多少堂單堂課與多少個系列當成封面（刪除前提醒用）。
export async function countPhotoCoverUsageCore(
  teacherProfileId: string,
): Promise<Map<string, { sessions: number; series: number }>> {
  const [sessions, series] = await Promise.all([
    prisma.classSession.groupBy({
      by: ["coverPhotoId"],
      where: { teacherProfileId, coverPhotoId: { not: null } },
      _count: { _all: true },
    }),
    prisma.recurringClassSeries.groupBy({
      by: ["coverPhotoId"],
      where: { teacherProfileId, coverPhotoId: { not: null } },
      _count: { _all: true },
    }),
  ]);
  const usage = new Map<string, { sessions: number; series: number }>();

  for (const row of sessions) {
    if (row.coverPhotoId) usage.set(row.coverPhotoId, { sessions: row._count._all, series: usage.get(row.coverPhotoId)?.series ?? 0 });
  }

  for (const row of series) {
    if (row.coverPhotoId) usage.set(row.coverPhotoId, { sessions: usage.get(row.coverPhotoId)?.sessions ?? 0, series: row._count._all });
  }

  return usage;
}
