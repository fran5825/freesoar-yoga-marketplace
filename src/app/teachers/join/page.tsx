import { getCurrentUser } from "@/lib/auth/session";

import { PublicFooter } from "../../_components/public-footer";
import { PublicHeader } from "../../_components/public-header";

import { TeacherApplicationForm } from "./_components/TeacherApplicationForm";
import { TeacherJoinExplainer } from "./_components/TeacherJoinExplainer";

// teacher-join-gated-application Slice 2：比照 teacher-initiated-open-classes Slice D
// 在 src/app/classes/[classSessionId]/page.tsx 已驗證過的 pattern——用不拋例外的
// getCurrentUser()（不是 requireUser()）判斷登入狀態，未登入渲染訪客導覽內容，
// 已登入才渲染 Slice 1 拆出來的申請表單，避免「先閃一下表單、才發現要登入」的畫面閃爍。
export default async function TeacherJoinPage() {
  const currentUser = await getCurrentUser();

  return (
    <div className="flex min-h-screen flex-col bg-cream text-ink">
      <PublicHeader />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-5 py-10 sm:px-8 sm:py-14">
        {currentUser ? <TeacherApplicationForm /> : <TeacherJoinExplainer />}
      </main>
      <PublicFooter />
    </div>
  );
}
