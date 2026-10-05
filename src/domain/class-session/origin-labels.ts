import type { ClassSessionOrigin } from "@prisma/client";

// organizer-usability-redesign 票 09（spec 13.6）：課程來源在團主與管理員畫面上的文字。
// 一律依 origin 判斷，不從 demand／organizer 是否為空推導。學員與老師的標籤在各自的元件裡。

export const classOriginLabelsForOrganizer: Record<ClassSessionOrigin, string> = {
  organizer_matched: "找老師媒合",
  teacher_initiated: "老師開課",
  organizer_direct: "直接邀請合作老師",
};

export const classOriginLabelsForAdmin: Record<ClassSessionOrigin, string> = {
  organizer_matched: "團主媒合",
  teacher_initiated: "老師開課",
  organizer_direct: "團主直接開團",
};
