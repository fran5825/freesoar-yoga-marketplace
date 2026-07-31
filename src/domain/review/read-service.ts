import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

import type { TeacherRatingSummary } from "./rating-summary";

export type ClassSessionReviewEntry = {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: Date;
  reviewerLabel: string;
};

// D7：僅供 Organizer 的單一 class session 詳情頁使用（own-scoped，比照既有
// listConfirmedEnrollmentsForClassSession 的既有形狀：查不到就回傳 null，not-found 語意
// 不洩漏擁有權差異）。評價作者顯示既有 name/email fallback 的既有 label 邏輯，不匿名化
// （D4 修正版）。
export async function listReviewsForClassSession(
  classSessionId: string,
): Promise<ClassSessionReviewEntry[] | null> {
  const currentUser = await requireUser();

  const ownClassSession = await prisma.classSession.findFirst({
    where: { id: classSessionId, organizerProfile: { userId: currentUser.id } },
    select: { id: true },
  });

  if (!ownClassSession) {
    return null;
  }

  const reviews = await prisma.review.findMany({
    where: { classSessionId },
    select: {
      id: true,
      rating: true,
      comment: true,
      createdAt: true,
      reviewer: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return reviews.map((review) => ({
    id: review.id,
    rating: review.rating,
    comment: review.comment,
    createdAt: review.createdAt,
    reviewerLabel: review.reviewer.name ?? review.reviewer.email ?? "會員",
  }));
}

// D3：即時 aggregate 查詢，Prisma 直接轉譯成資料庫端 AVG()/COUNT()，不會把逐筆 Review 撈進應用層。
export async function getOwnTeacherRatingSummary(): Promise<TeacherRatingSummary | null> {
  const currentUser = await requireUser();

  const teacherProfile = await prisma.teacherProfile.findUnique({
    where: { userId: currentUser.id },
    select: { id: true },
  });

  if (!teacherProfile) {
    return null;
  }

  const aggregate = await prisma.review.aggregate({
    where: { classSession: { teacherProfileId: teacherProfile.id } },
    _avg: { rating: true },
    _count: { rating: true },
  });

  return {
    averageRating: aggregate._avg.rating,
    reviewCount: aggregate._count.rating,
  };
}
