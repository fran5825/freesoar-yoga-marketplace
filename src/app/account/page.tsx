import { requireUser } from "@/lib/auth/session";
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
        <p className="text-sm font-medium text-amber-700">
          Minimal account smoke page
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Account
        </h1>
        <p className="mt-3 text-sm text-gray-600">
          Not a production dashboard.
        </p>
      </div>

      <section className="rounded border border-gray-200 p-4 text-sm">
        <h2 className="text-lg font-medium">User basic info</h2>
        <div className="mt-4 space-y-3">
          <p className="break-all">
            <span className="font-medium">ID: </span>
            {user.id}
          </p>
          <p className="break-all">
            <span className="font-medium">Email: </span>
            {user.email ?? "Not provided"}
          </p>
          <p>
            <span className="font-medium">Name: </span>
            {user.name ?? "Not provided"}
          </p>
          <p className="break-all">
            <span className="font-medium">Image: </span>
            {user.image ?? "Not provided"}
          </p>
          <p>
            <span className="font-medium">isAdmin: </span>
            {String(user.isAdmin)}
          </p>
        </div>
      </section>

      <section className="rounded border border-gray-200 p-4 text-sm">
        <h2 className="text-lg font-medium">Capability smoke</h2>
        <div className="mt-4 space-y-3">
          <p>
            <span className="font-medium">Member: </span>
            yes
          </p>
          <p>
            <span className="font-medium">Admin: </span>
            {user.isAdmin ? "yes" : "no"}
          </p>
          <p>
            <span className="font-medium">Teacher: </span>
            not loaded in this slice
          </p>
          <p>
            <span className="font-medium">Organizer: </span>
            not loaded in this slice
          </p>
        </div>
      </section>
    </main>
  );
}
