import { redirect } from "next/navigation";

import { getOwnTeacherProfileApplicationSnapshot } from "@/domain/teacher-profile/service";
import { getCurrentUser } from "@/lib/auth/session";

import { PublicFooter } from "../../_components/public-footer";
import { PublicHeader } from "../../_components/public-header";

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

  return (
    <div className="flex min-h-screen flex-col bg-cream text-ink">
      <PublicHeader />
      <main
        className={`mx-auto flex w-full flex-1 flex-col gap-10 px-5 py-10 sm:px-8 sm:py-14 ${
          currentUser ? "max-w-4xl" : "max-w-5xl"
        }`}
      >
        {currentUser ? <TeacherApplicationForm /> : <TeacherJoinExplainer />}
      </main>
      <PublicFooter />
    </div>
  );
}
