import { requireAdmin } from "@/lib/auth/session";
import { notFound } from "next/navigation";

export default async function DevAdminGuardSmokeTestPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  let status: "passed" | "failed" = "failed";
  let message = "";
  let user:
    | {
        id: string;
        email: string | null;
        name: string | null;
        isAdmin: boolean;
      }
    | null = null;

  try {
    const adminUser = await requireAdmin();

    status = "passed";
    message = "Admin guard passed";
    user = {
      id: adminUser.id,
      email: adminUser.email,
      name: adminUser.name,
      isAdmin: adminUser.isAdmin,
    };
  } catch (error) {
    message = error instanceof Error ? error.message : "Admin guard failed";
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 py-12">
      <div>
        <p className="text-sm font-medium text-amber-700">
          Dev smoke test only
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Admin Guard Smoke Test
        </h1>
        <p className="mt-3 text-sm text-gray-600">
          This page only verifies server-side requireAdmin behavior. It is not a
          production admin dashboard.
        </p>
      </div>

      <section className="rounded border border-gray-200 p-4">
        <h2 className="text-lg font-medium">Guard status</h2>
        <p
          className={
            status === "passed"
              ? "mt-4 text-sm font-medium text-green-700"
              : "mt-4 text-sm font-medium text-amber-700"
          }
        >
          {message}
        </p>
      </section>

      {user ? (
        <section className="rounded border border-gray-200 p-4 text-sm">
          <h2 className="text-lg font-medium">Admin user</h2>
          <div className="mt-4 space-y-3">
            <p>
              <span className="font-medium">ID: </span>
              {user.id}
            </p>
            <p>
              <span className="font-medium">Email: </span>
              {user.email ?? "Not provided"}
            </p>
            <p>
              <span className="font-medium">Name: </span>
              {user.name ?? "Not provided"}
            </p>
            <p>
              <span className="font-medium">isAdmin: </span>
              {String(user.isAdmin)}
            </p>
          </div>
        </section>
      ) : null}
    </main>
  );
}
