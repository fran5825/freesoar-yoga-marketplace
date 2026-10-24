import type { TeacherProfileStatus } from "@prisma/client";

import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

import {
  TEACHER_GET_STARTED_STEPS,
  type TeacherGetStartedStepCopy,
  type TeacherGetStartedStepKey,
} from "./get-started-steps";

// teacher-first-run 票 08（spec「開始使用」）：剛通過審核的老師在總覽最上方看到的上手步驟。
// 三步的完成與否都從既有資料判斷，不新增欄位：
//   1. 填收款與聯絡：收款帳號（paymentAccountInfo）trim 後有內容。
//   2. 開第一堂課：老師有任何一堂自己開的課（origin = teacher_initiated，任何狀態都算；團主媒合的課不算）。
//   3. 公開我的老師頁（可跳過）：isPublicPageEnabled 為 true。
// 收起規則（切票時查證沒有可存介面偏好的既有欄位，採 spec 替代規則）：1、2 兩步完成就自動收起，
// 不論第 3 步；「先不用」只記在這個瀏覽器（由頁面元件處理）。

const stepActions: Record<TeacherGetStartedStepKey, { href: string; actionLabel: string }> = {
  payment: { href: "/teacher/profile/payment", actionLabel: "前往填寫收款與聯絡" },
  first_class: { href: "/teacher/classes/new", actionLabel: "開第一堂課" },
  public_page: { href: "/teacher/profile/info#public-page", actionLabel: "前往設定老師公開頁" },
};

export type TeacherGetStartedStep = TeacherGetStartedStepCopy & {
  done: boolean;
  href: string;
  actionLabel: string;
};

export type TeacherGetStarted = {
  teacherProfileId: string;
  steps: TeacherGetStartedStep[];
};

export function buildTeacherGetStarted(input: {
  teacherProfileId: string;
  status: TeacherProfileStatus;
  paymentAccountInfo: string | null;
  hasOwnClass: boolean;
  isPublicPageEnabled: boolean;
}): TeacherGetStarted | null {
  // 只給 approved 的老師；暫停中不能開新課，未通過的還在申請流程。
  if (input.status !== "approved") {
    return null;
  }

  const done: Record<TeacherGetStartedStepKey, boolean> = {
    payment: (input.paymentAccountInfo ?? "").trim().length > 0,
    first_class: input.hasOwnClass,
    public_page: input.isPublicPageEnabled,
  };

  if (done.payment && done.first_class) {
    return null;
  }

  return {
    teacherProfileId: input.teacherProfileId,
    steps: TEACHER_GET_STARTED_STEPS.map((step) => ({
      ...step,
      ...stepActions[step.key],
      done: done[step.key],
    })),
  };
}

export async function getOwnTeacherGetStarted(): Promise<TeacherGetStarted | null> {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return null;
  }

  const profile = await prisma.teacherProfile.findUnique({
    where: { userId: currentUser.id },
    select: { id: true, status: true, paymentAccountInfo: true, isPublicPageEnabled: true },
  });

  if (!profile || profile.status !== "approved") {
    return null;
  }

  const ownClass = await prisma.classSession.findFirst({
    where: { teacherProfileId: profile.id, origin: "teacher_initiated" },
    select: { id: true },
  });

  return buildTeacherGetStarted({
    teacherProfileId: profile.id,
    status: profile.status,
    paymentAccountInfo: profile.paymentAccountInfo,
    hasOwnClass: ownClass !== null,
    isPublicPageEnabled: profile.isPublicPageEnabled,
  });
}
