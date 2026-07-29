import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

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
