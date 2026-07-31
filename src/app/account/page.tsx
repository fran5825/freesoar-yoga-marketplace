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
        <p className="text-sm font-medium text-amber-700">Account</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Account
        </h1>
        <p className="mt-3 text-sm text-gray-600">
          You are signed in to Free Soar Yoga.
        </p>
      </div>

      <section className="rounded border border-gray-200 p-4 text-sm">
        <h2 className="text-lg font-medium">Your account</h2>
        <div className="mt-4 space-y-3">
          <p>
            <span className="font-medium">Name: </span>
            {user.name ?? "Not provided"}
          </p>
          <p className="break-all">
            <span className="font-medium">Email: </span>
            {user.email ?? "Not provided"}
          </p>
        </div>
      </section>

      <section className="rounded border border-gray-200 p-4 text-sm">
        <h2 className="text-lg font-medium">Account status</h2>
        <div className="mt-4 space-y-3">
          <p>
            <span className="font-medium">Signed in: </span>
            yes
          </p>
          <p>Member account active.</p>
        </div>
      </section>

      <section className="rounded border border-gray-200 p-4 text-sm">
        <h2 className="text-lg font-medium">我的使用入口</h2>
        <p className="mt-2 text-gray-600">
          依照你現在想完成的事情，前往適合的總覽。
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Link
            className="rounded-lg border border-amber-200 bg-amber-50 p-4 transition hover:border-amber-300 hover:bg-amber-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
            href="/member/dashboard"
          >
            <span className="block font-medium text-gray-900">會員總覽</span>
            <span className="mt-1 block leading-6 text-gray-600">
              查看近期通知、報名狀態與即將到來的課程。
            </span>
          </Link>
          <Link
            className="rounded-lg border border-sky-200 bg-sky-50 p-4 transition hover:border-sky-300 hover:bg-sky-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700"
            href="/organizer/dashboard"
          >
            <span className="block font-medium text-gray-900">團主總覽</span>
            <span className="mt-1 block leading-6 text-gray-600">
              建立團主資料，或查看與管理自己的團課需求。
            </span>
          </Link>
        </div>
      </section>

      <section className="rounded border border-gray-200 p-4 text-sm">
        <h2 className="text-lg font-medium">Notifications</h2>
        <p className="mt-3 text-sm text-gray-600">
          <Link className="text-sky-700 underline underline-offset-2" href="/notifications">
            查看我的通知
          </Link>
        </p>
      </section>
    </main>
  );
}
