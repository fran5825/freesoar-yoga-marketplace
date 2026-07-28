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
