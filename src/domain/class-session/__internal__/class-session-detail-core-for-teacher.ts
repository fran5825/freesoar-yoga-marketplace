// teacher-usability 第 05 票：老師端單堂課詳情的讀取核心。
// 不依賴登入狀態（呼叫端傳入 userId），讓測試能直接驗證權限邏輯；對外的 requireUser() 檢查在
// read-service.ts 的 getOwnClassSessionDetailForTeacher。
// 欄位與列表（listOwnClassSessionsForTeacher）完全相同，兩邊共用同一份 select，
// 不新增任何可讀欄位；Organization 只揭露名稱，不含團主聯絡資訊，也不含學員電話與頭像。

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export const teacherFacingClassSessionSelect = {
  id: true,
  title: true,
  description: true,
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
  recurringClassSeries: { select: { title: true } },
  // 只含 confirmed／pending 的報名（其他狀態不含）。
  enrollments: {
    where: { status: { in: ["confirmed", "pending"] } },
    select: {
      id: true,
      status: true,
      notes: true,
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
