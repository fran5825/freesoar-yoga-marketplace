// teacher-usability 第 05 票：老師端單堂課詳情的讀取核心。
// 不依賴登入狀態（呼叫端傳入 userId），讓測試能直接驗證權限邏輯；對外的 requireUser() 檢查在
// read-service.ts 的 getOwnClassSessionDetailForTeacher。
// 欄位與列表（listOwnClassSessionsForTeacher）完全相同，兩邊共用同一份 select，
// 不新增任何可讀欄位；Organization 只揭露名稱，不含團主聯絡資訊，也不含學員電話與頭像。

import type { Prisma } from "@prisma/client";

import { photoRefSelect } from "@/domain/teacher-photo/display";
import { prisma } from "@/lib/prisma";

export const teacherFacingClassSessionSelect = {
  id: true,
  title: true,
  description: true,
  suitableFor: true,
  preparationNotes: true,
  priceNote: true,
  // teacher-showcase-photos 票 04：封面照片 id（系列場次用系列的封面）。
  coverPhotoId: true,
  coverPhoto: photoRefSelect,
  serviceType: true,
  serviceTypes: true,
  yogaStyles: true,
  startAt: true,
  endAt: true,
  location: true,
  capacity: true,
  isPublic: true,
  status: true,
  createdAt: true,
  origin: true,
  recurringClassSeriesId: true,
  requiresApproval: true,
  demandRequest: { select: { targetLevel: true } },
  organization: { select: { name: true } },
  recurringClassSeries: { select: { title: true, kind: true, coverPhotoId: true, coverPhoto: photoRefSelect } },
  // 含 confirmed／pending 的報名，以及「已有付款紀錄（paid／refunded）」的報名——已付款後被取消的報名仍要讓老師看到並能標記退款
  // （lightweight-payment-v0 P9；其餘已取消且從未付款的報名不含）。
  enrollments: {
    where: {
      OR: [{ status: { in: ["confirmed", "pending"] } }, { paymentStatus: { not: "unpaid" } }],
    },
    select: {
      id: true,
      status: true,
      notes: true,
      // lightweight-payment-v0：付款狀態與對帳資訊；老師可見自己班級報名的 transferNote／paymentNote／退款原因。
      paymentStatus: true,
      transferNote: true,
      paymentNote: true,
      paymentConfirmedAt: true,
      paymentConfirmedByRole: true,
      paymentRefundedAt: true,
      paymentRefundedByRole: true,
      paymentRefundReason: true,
      // teacher-class-scheduling 票 10：標示整期或單堂；整期的逐場報名不能在單場個別確認。
      seriesEnrollmentId: true,
      user: { select: { name: true, email: true } },
    },
  },
  reviews: {
    select: {
      id: true,
      rating: true,
      comment: true,
      createdAt: true,
      reviewer: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "asc" },
  },
} satisfies Prisma.ClassSessionSelect;

// 沒有老師資料、課程不存在、課程屬於別的老師，一律回傳 null，不洩漏存在性差異。
// own-scope 直接寫在查詢的 WHERE（teacherProfileId 必須符合），不是先查再事後比對。
// 不檢查 TeacherProfile.status：查看自己既有的課是「查看已存在的承諾」，suspended 老師仍可看
// （D15，與 listOwnClassSessionsForTeacher 一致）。
export async function getClassSessionDetailForTeacherUser(
  userId: string,
  classSessionId: string,
) {
  const teacherProfile = await prisma.teacherProfile.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!teacherProfile) {
    return null;
  }

  return prisma.classSession.findFirst({
    where: { id: classSessionId, teacherProfileId: teacherProfile.id },
    select: teacherFacingClassSessionSelect,
  });
}
