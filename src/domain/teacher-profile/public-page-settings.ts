// teacher-showcase-photos 票 06（spec S6）：老師自己決定要不要公開自己的老師頁；預設關閉。
// 只有審核通過（approved）的老師能開啟；暫停（suspended）期間公開頁一律看不到（讀取端另外擋），
// 但老師自己的開關狀態保留，恢復後不需要重設。關閉隨時可以，立即生效。

import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export type OwnPublicPageSetting =
  | { state: "not_available" }
  | { state: "ok"; teacherProfileId: string; enabled: boolean; canChange: boolean; visible: boolean };

export async function getOwnPublicPageSetting(): Promise<OwnPublicPageSetting> {
  const user = await requireUser();
  const profile = await prisma.teacherProfile.findUnique({
    where: { userId: user.id },
    select: { id: true, status: true, isPublicPageEnabled: true },
  });

  if (!profile || (profile.status !== "approved" && profile.status !== "suspended")) {
    return { state: "not_available" };
  }

  return {
    state: "ok",
    teacherProfileId: profile.id,
    enabled: profile.isPublicPageEnabled,
    canChange: profile.status === "approved",
    // 真的看得到：開啟且審核通過。
    visible: profile.isPublicPageEnabled && profile.status === "approved",
  };
}

export type SetPublicPageResult =
  | { ok: true }
  | { ok: false; code: "authentication_required" | "not_allowed"; message: string };

export async function setOwnPublicPageEnabled(enabled: boolean): Promise<SetPublicPageResult> {
  let userId: string;

  try {
    userId = (await requireUser()).id;
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      return { ok: false, code: "authentication_required", message: "請先登入。" };
    }

    throw error;
  }

  const updated = await prisma.teacherProfile.updateMany({
    where: { userId, status: "approved" },
    data: { isPublicPageEnabled: enabled },
  });

  return updated.count === 1
    ? { ok: true }
    : { ok: false, code: "not_allowed", message: "通過老師審核後，才能設定公開頁。" };
}
