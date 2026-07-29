// __internal__：不是通用 API。只給 (1) 唯一的 auth-resolving 外層（service.ts 的
// submitOwnReview）與 (2) Playwright 決定性測試/驗證腳本直接呼叫。抽出這個 pure-core
// 的理由跟 teacher-profile-suspension 一輪的 suspend-restore-core.ts 相同：
// submitOwnReview 頂層呼叫 requireUser()（依賴真正的 HTTP session），沒有這層拆分的話，
// 測試（含通知正確性）就沒辦法在 Node context 直接呼叫這個函式。

import type { NotificationType } from "@prisma/client";
import { Prisma } from "@prisma/client";

import { notifyUsers } from "@/domain/notification/create";
import type { NotificationPayload, NotificationRecipient } from "@/domain/notification/types";
import { prisma } from "@/lib/prisma";

export type NotifyFn = (
  type: NotificationType,
  recipients: NotificationRecipient[],
  payload: NotificationPayload,
) => Promise<void>;

export type SubmitReviewForUserErrorCode =
  | "review_not_eligible"
  | "review_already_exists"
  | "review_submit_failed";

export type SubmitReviewForUserResult =
  | { ok: true; reviewId: string }
  | { ok: false; code: SubmitReviewForUserErrorCode };

// D1/D2/D6：Member own-scoped（own-scoping 由呼叫端傳入的 userId 保證，這裡直接信任）。
// 原子 INSERT ... SELECT ... WHERE EXISTS 同時檢查兩個資格條件——(a) 該 ClassSession 目前
// 是 completed、(b) 這位 user 對這堂課有一筆 confirmed 的 Enrollment——比照既有
// submitDemandResponseForTeacher 的既有寫法，兩個條件不合都收斂成同一個 review_not_eligible
// 錯誤碼（不細分是哪一個條件不合，理由同既有先例：呼叫端不需要知道細節，只需要知道
// 「現在不能評價」）。`@@unique([classSessionId, reviewerUserId])` 這個 DB 層級的 unique
// constraint 本身就是唯一需要的併發保護，不需要 SELECT ... FOR UPDATE（D6）。
// D5：resolver query + notifyUsers 一律在寫入成功之後才執行，不進原子寫入本身；例外被
// 吞掉，不影響回傳給呼叫端的結果（比照既有先例）。
export async function submitReviewForUser(
  userId: string,
  classSessionId: string,
  input: { rating: number; comment: string | null },
  notifyOverride: NotifyFn = notifyUsers,
): Promise<SubmitReviewForUserResult> {
  try {
    const id = crypto.randomUUID();
    const now = new Date();

    const insertedRows = await prisma.$queryRaw<{ id: string }[]>`
      INSERT INTO "Review" ("id", "classSessionId", "reviewerUserId", "rating", "comment", "createdAt")
      SELECT ${id}, ${classSessionId}, ${userId}, ${input.rating}, ${input.comment}, ${now}
      WHERE EXISTS (
        SELECT 1 FROM "ClassSession"
        WHERE "id" = ${classSessionId} AND "status" = 'completed'::"ClassSessionStatus"
      )
      AND EXISTS (
        SELECT 1 FROM "Enrollment"
        WHERE "classSessionId" = ${classSessionId} AND "userId" = ${userId} AND "status" = 'confirmed'::"EnrollmentStatus"
      )
      RETURNING "id"
    `;

    if (insertedRows.length === 0) {
      return { ok: false, code: "review_not_eligible" };
    }

    const reviewId = insertedRows[0].id;

    try {
      const detail = await prisma.classSession.findUnique({
        where: { id: classSessionId },
        select: {
          title: true,
          teacherProfile: { select: { userId: true } },
        },
      });
      const reviewer = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, email: true },
      });

      if (detail) {
        await notifyOverride(
          "review_submitted",
          [{ userId: detail.teacherProfile.userId, role: "counterpart" }],
          {
            actorLabel: reviewer?.name ?? reviewer?.email ?? undefined,
            classSessionTitle: detail.title,
          },
        );
      }
    } catch (notifyError) {
      console.error("[notification] review_submitted trigger failed", notifyError);
    }

    return { ok: true, reviewId };
  } catch (error) {
    if (isUniqueConstraintViolation(error)) {
      return { ok: false, code: "review_already_exists" };
    }

    return { ok: false, code: "review_submit_failed" };
  }
}

function isUniqueConstraintViolation(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return true;
  }

  // Raw query 的 unique violation 經 Prisma 包裝為 P2010，訊息含底層 Postgres 錯誤碼 23505。
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2010" &&
    typeof error.message === "string" &&
    error.message.includes("23505")
  ) {
    return true;
  }

  return false;
}
