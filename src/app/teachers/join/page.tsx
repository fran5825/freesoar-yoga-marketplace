import { redirect } from "next/navigation";

import { getOwnTeacherProfileApplicationSnapshot } from "@/domain/teacher-profile/service";
import { getCurrentUser } from "@/lib/auth/session";

import { SiteShell } from "../../_components/site-shell";

import { TeacherApplicationForm } from "./_components/TeacherApplicationForm";
import { TeacherJoinExplainer } from "./_components/TeacherJoinExplainer";

// teacher-join-gated-application Slice 2：比照 teacher-initiated-open-classes Slice D
// 在 src/app/classes/[classSessionId]/page.tsx 已驗證過的 pattern——用不拋例外的
// getCurrentUser()（不是 requireUser()）判斷登入狀態，未登入渲染訪客導覽內容，
// 已登入才渲染 Slice 1 拆出來的申請表單，避免「先閃一下表單、才發現要登入」的畫面閃爍。
// 2026-09-25：已登入的申請表單頁寬與其他老師頁一致（max-w-4xl）；未登入的行銷導覽維持較寬的 5xl。
export default async function TeacherJoinPage() {
  const currentUser = await getCurrentUser();

  // 2026-09-25：已通過審核或已暫停的老師不需要再看申請頁（表單只剩唯讀），直接進老師總覽。
  // 草稿、審核中、被退回的人還要在這裡填寫、查看或修正，沒有老師資料的人也留在這頁。
  if (currentUser) {
    const teacherProfile = await getOwnTeacherProfileApplicationSnapshot();

    if (
      teacherProfile &&
      (teacherProfile.status === "approved" ||
        teacherProfile.status === "suspended")
    ) {
      redirect("/teacher/dashboard");
    }
  }

  // 2026-09-27 signed-in-navigation 票 05：登入後不再用公開 header。
  // wrong-route-fixes 票 03：已登入一律用老師專區導覽列，免得還沒送申請的人看到「學員專區」以為登錯身分。
  // 老師專區對還沒有老師資料的人本來就只顯示總覽、老師資料、通知。頁面內容不變。
  return (
    <SiteShell
      publicMainClassName="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-5 py-10 sm:px-8 sm:py-14"
      signedInArea="teacher"
      signedInClassName="flex flex-col gap-10"
    >
      {currentUser ? <TeacherApplicationForm /> : <TeacherJoinExplainer />}
    </SiteShell>
  );
}
