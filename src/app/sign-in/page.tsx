import { auth, signIn, signOut } from "@/auth";
import Link from "next/link";

export default async function SignInPage() {
  const session = await auth();

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 py-12">
      <div>
        <p className="text-sm font-medium text-amber-700">
          Minimal sign-in page
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Sign in
        </h1>
        <p className="mt-3 text-sm text-gray-600">
          Not a production auth experience.
        </p>
      </div>

      {session?.user ? (
        <>
          <section className="rounded border border-gray-200 p-4 text-sm">
            <h2 className="text-lg font-medium">Signed in</h2>
            <p className="mt-4">
              <span className="font-medium">User: </span>
              {session.user.email ?? session.user.name ?? "Unknown user"}
            </p>
          </section>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              className="rounded bg-gray-900 px-4 py-2 text-center text-sm font-medium text-white"
              href="/account"
            >
              Go to account
            </Link>

            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/sign-in" });
              }}
            >
              <button
                className="w-full rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-900 sm:w-auto"
                type="submit"
              >
                Sign out
              </button>
            </form>
          </div>
        </>
      ) : (
        <>
          <section className="rounded border border-gray-200 p-4 text-sm">
            <h2 className="text-lg font-medium">Google sign-in</h2>
            <p className="mt-4 text-gray-600">
              After sign-in, you will be redirected to <code>/account</code>.
            </p>
          </section>

          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: "/account" });
            }}
          >
            <button
              className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white"
              type="submit"
            >
              Sign in with Google
            </button>
          </form>
        </>
      )}
    </main>
  );
}
