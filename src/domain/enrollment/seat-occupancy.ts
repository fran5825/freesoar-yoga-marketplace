// enrollment-re-enrollment 票 03（spec 4.4）：「一堂課占用幾個名額」只在這裡定義一次。
//
//   占用 = pending + confirmed 的報名數
//        + （課程屬於 term_only 期班時）請假中的報名數
//
// 「請假中」＝ status = cancelled、cancelledBy = member、屬於整期報名，且那筆整期報名仍是 pending／confirmed。
// term_only（只收整期）的請假名額保留給請假的人，到開課前都不算空位，新的整期學員占不到，
// 學員取消請假時一定有位子；term_and_single 與其他課程的請假名額釋出給單堂報名（不加這一項）。
//
// 所有「用名額做判斷」的地方（整期報名、改課人數下限、畫面剩餘名額與可報名判斷）都用這個條件，
// 不要各自寫 { status: { in: ["pending", "confirmed"] } }。
import type { Prisma } from "@prisma/client";

export const occupyingEnrollmentWhere: Prisma.EnrollmentWhereInput = {
  OR: [
    { status: { in: ["pending", "confirmed"] } },
    {
      status: "cancelled",
      cancelledBy: "member",
      seriesEnrollmentId: { not: null },
      seriesEnrollment: { status: { in: ["pending", "confirmed"] } },
      classSession: { recurringClassSeries: { kind: "term", termEnrollmentMode: "term_only" } },
    },
  ],
};
