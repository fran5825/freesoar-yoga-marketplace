import type { ReactNode } from "react";

import { auth, signOut } from "@/auth";

import { RoleNav, type RoleNavLink } from "./role-nav";
import { getRoleSwitchOptions } from "./role-switch-options";

// 登入後角色專區的共同外框（導覽列＋統一頁寬 max-w-4xl）。各專區的 layout 只需要傳自己的連結。
// /notifications 不在任何專區底下，所以由該頁自己依身分包這個外框，導覽列才不會消失。
// 沒登入時不顯示導覽列（各頁面自己會導向登入頁）。
export async function RoleShell({
  areaLabel,
  links,
  primaryAction,
  children,
}: {
  areaLabel: string;
  links: RoleNavLink[];
  primaryAction?: RoleNavLink;
  children: ReactNode;
}) {
  const session = await auth();
  const signedInLabel = session?.user
    ? (session.user.email ?? session.user.name ?? "已登入")
    : null;

  const roleOptions = session?.user ? await getRoleSwitchOptions() : [];

  return (
    <div className="flex min-h-screen flex-col bg-cream text-ink">
      {signedInLabel ? (
        <RoleNav
          areaLabel={areaLabel}
          links={links}
          primaryAction={primaryAction}
          roleOptions={roleOptions}
          signOutAction={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }}
          signedInLabel={signedInLabel}
        />
      ) : null}
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-5 py-8 sm:px-8 sm:py-12">
        {children}
      </main>
    </div>
  );
}
