import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 py-12">
      <div>
        <p className="text-sm font-medium text-amber-700">
          Free Soar Yoga
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Free Soar Yoga
        </h1>
        <p className="mt-3 text-sm text-gray-600">
          An early yoga marketplace entry for group-class practice.
        </p>
      </div>

      <section className="rounded border border-gray-200 p-4 text-sm">
        <h2 className="text-lg font-medium">Start here</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Link
            className="rounded bg-gray-900 px-4 py-3 text-center text-sm font-medium text-white"
            href="/sign-in"
          >
            Sign in
          </Link>
          <Link
            className="rounded border border-gray-300 px-4 py-3 text-center text-sm font-medium text-gray-900"
            href="/account"
          >
            Account
          </Link>
        </div>
      </section>
    </main>
  );
}
