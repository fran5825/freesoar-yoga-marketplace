import Link from "next/link";
import { redirect } from "next/navigation";

import { getOwnOrganizerContext } from "@/domain/organizer-profile/service";
import { getOwnTeacherProfileApplicationSnapshot } from "@/domain/teacher-profile/service";
import { requireUser } from "@/lib/auth/session";

import { PublicFooter } from "../_components/public-footer";
import { PublicHeader } from "../_components/public-header";

type Entry = {
  eyebrow: string;
  title: string;
  description: string;
  href: string;
  action: string;
  isActive: boolean;
};

// 2026-09-25 organizer-usability 票 03：「我的帳戶」改成依身分列出入口的中心。
// 同時是團主又是老師的人可以自己選要去哪；還沒有的身分顯示「開始成為…」，
// 連到對應的招募／申請頁。只讀取身分狀態決定顯示什麼，不改任何權限。
export default async function AccountPage() {
  let user: Awaited<ReturnType<typeof requireUser>>;

  try {
    user = await requireUser();
  } catch {
    redirect("/sign-in");
  }

  const [organizerContext, teacherProfile] = await Promise.all([
    getOwnOrganizerContext(),
    getOwnTeacherProfileApplicationSnapshot(),
  ]);

  const entries: Entry[] = [
    {
      eyebrow: "學員",
      title: "會員總覽",
      description: "查看近期通知、報名狀態與即將到來的課程。",
      href: "/member/dashboard",
      action: "前往會員總覽",
      isActive: true,
    },
    organizerContext
      ? {
          eyebrow: "團主",
          title: "團主總覽",
          description: "查看與管理自己的團課需求、老師回覆與已成立的課程。",
          href: "/organizer/dashboard",
          action: "前往團主總覽",
          isActive: true,
        }
      : {
          eyebrow: "團主",
          title: "開始成為團主",
          description: "為公司、社團或社區發起團課需求，平台審核後讓合適的老師看到。",
          href: "/organizers/request",
          action: "了解如何發起團課",
          isActive: false,
        },
    teacherProfile
      ? {
          eyebrow: "老師",
          title: "老師總覽",
          description: "查看審核狀態、已建立的課程，或編輯你的老師資料。",
          href: "/teacher/dashboard",
          action: "前往老師總覽",
          isActive: true,
        }
      : {
          eyebrow: "老師",
          title: "開始成為老師",
          description: "填寫老師資料送審，通過後可回應團課需求或開設自己的課程。",
          href: "/teachers/join",
          action: "了解老師加入",
          isActive: false,
        },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-cream text-ink">
      <PublicHeader />
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-5 py-8 sm:px-8 sm:py-12">
        <header className="border-b border-ink/15 pb-6">
          <h1 className="text-3xl font-semibold tracking-tight text-ink">
            我的帳戶
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-soft">
            {user.name ?? "你好"}
            {user.email ? `（${user.email}）` : ""}，依你現在想完成的事情，前往適合的入口。
          </p>
        </header>

        <section className="grid gap-4">
          <h2 className="text-xl font-semibold text-ink">我的使用入口</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {entries.map((entry) => (
              <Link
                className={`flex flex-col gap-2 rounded-2xl border p-5 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay ${
                  entry.isActive
                    ? "border-pine/25 bg-pine-tint hover:border-pine/40"
                    : "border-ink/15 bg-white hover:bg-sand"
                }`}
                href={entry.href}
                key={entry.title}
              >
                <span className="text-xs font-medium text-clay">
                  {entry.eyebrow}
                </span>
                <span className="text-lg font-semibold text-ink">
                  {entry.title}
                </span>
                <span className="flex-1 text-sm leading-6 text-ink-soft">
                  {entry.description}
                </span>
                <span className="text-sm font-medium text-pine">
                  {entry.action} →
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-ink/15 bg-white p-5">
          <h2 className="text-lg font-semibold text-ink">通知</h2>
          <p className="mt-2 text-sm text-ink-soft">
            <Link
              className="font-medium text-clay underline underline-offset-4"
              href="/notifications"
            >
              查看我的通知
            </Link>
          </p>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
