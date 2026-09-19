import { requireUser } from "@/lib/auth/session";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function AccountSmokePage() {
  let user:
    | {
        id: string;
        email: string | null;
        name: string | null;
        image: string | null;
        isAdmin: boolean;
      }
    | null = null;

  try {
    user = await requireUser();
  } catch {
    redirect("/sign-in");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 py-12">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">
          我的帳戶
        </h1>
        <p className="mt-3 text-sm text-ink-soft">
          你已登入飛索。
        </p>
      </div>

      <section className="rounded-2xl border border-ink/15 p-4 text-sm">
        <h2 className="text-lg font-medium">帳戶資料</h2>
        <div className="mt-4 space-y-3">
          <p>
            <span className="font-medium">姓名：</span>
            {user.name ?? "未提供"}
          </p>
          <p className="break-all">
            <span className="font-medium">電子郵件：</span>
            {user.email ?? "未提供"}
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-ink/15 p-4 text-sm">
        <h2 className="text-lg font-medium">帳戶狀態</h2>
        <div className="mt-4 space-y-3">
          <p>
            <span className="font-medium">登入狀態：</span>
            是
          </p>
          <p>會員帳戶為啟用狀態。</p>
        </div>
      </section>

      <section className="rounded-2xl border border-ink/15 p-4 text-sm">
        <h2 className="text-lg font-medium">我的使用入口</h2>
        <p className="mt-2 text-ink-soft">
          依照你現在想完成的事情，前往適合的總覽。
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Link
            className="rounded-lg border border-amber-200 bg-amber-50 p-4 transition hover:border-amber-300 hover:bg-amber-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
            href="/member/dashboard"
          >
            <span className="block font-medium text-ink">會員總覽</span>
            <span className="mt-1 block leading-6 text-ink-soft">
              查看近期通知、報名狀態與即將到來的課程。
            </span>
          </Link>
          <Link
            className="rounded-lg border border-pine/25 bg-pine-tint p-4 transition hover:border-pine/40 hover:bg-pine/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700"
            href="/organizer/dashboard"
          >
            <span className="block font-medium text-ink">團主總覽</span>
            <span className="mt-1 block leading-6 text-ink-soft">
              建立團主資料，或查看與管理自己的團課需求。
            </span>
          </Link>
        </div>
      </section>

      <section className="rounded-2xl border border-ink/15 p-4 text-sm">
        <h2 className="text-lg font-medium">通知</h2>
        <p className="mt-3 text-sm text-ink-soft">
          <Link className="text-clay underline underline-offset-2" href="/notifications">
            查看我的通知
          </Link>
        </p>
      </section>
    </main>
  );
}
