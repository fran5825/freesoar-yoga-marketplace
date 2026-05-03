import { auth, signIn, signOut } from "@/auth";
import { notFound } from "next/navigation";

export default async function DevAuthSmokeTestPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const session = await auth();
  const hasGoogleCredentials = Boolean(
    process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET,
  );

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 py-12">
      <div>
        <p className="text-sm font-medium text-amber-700">
          Dev smoke test only
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Auth Session Smoke Test
        </h1>
        <p className="mt-3 text-sm text-gray-600">
          這個頁面只用來驗證 Auth.js、Prisma Adapter 與 session 是否正常運作，不是正式產品頁。
        </p>
      </div>

      {!hasGoogleCredentials ? (
        <section className="rounded border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Google OAuth credentials 尚未設定。請在本機 `.env` 設定
          `AUTH_GOOGLE_ID` 與 `AUTH_GOOGLE_SECRET` 後再測試登入。
        </section>
      ) : null}

      <section className="rounded border border-gray-200 p-4">
        <h2 className="text-lg font-medium">Session status</h2>

        {session?.user ? (
          <div className="mt-4 space-y-3 text-sm">
            <p>
              <span className="font-medium">狀態：</span>
              已登入
            </p>
            <p>
              <span className="font-medium">Name：</span>
              {session.user.name ?? "未提供"}
            </p>
            <p>
              <span className="font-medium">Email：</span>
              {session.user.email ?? "未提供"}
            </p>
            <p className="break-all">
              <span className="font-medium">Image：</span>
              {session.user.image ?? "未提供"}
            </p>
          </div>
        ) : (
          <p className="mt-4 text-sm text-gray-600">目前沒有登入 session。</p>
        )}
      </section>

      <div className="flex gap-3">
        {session?.user ? (
          <form
            action={async () => {
              "use server";
              await signOut();
            }}
          >
            <button
              className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white"
              type="submit"
            >
              登出
            </button>
          </form>
        ) : (
          <form
            action={async () => {
              "use server";
              await signIn("google");
            }}
          >
            <button
              className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-600"
              disabled={!hasGoogleCredentials}
              type="submit"
            >
              使用 Google 登入
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
