import type { ReactNode } from "react";

import { auth } from "@/auth";

import { MemberShell } from "../member/_components/MemberShell";
import { TeacherShell } from "../teacher/_components/TeacherShell";

import { LastRoleShell } from "./last-role-shell";
import { PublicFooter } from "./public-footer";
import { PublicHeader } from "./public-header";

export type SignedInArea = "member" | "teacher" | "last-role";

// signed-in-navigation 決策 1：公開 header 只給沒登入的訪客；登入後每一頁都用專區導覽列。
// 公開頁（課程、老師合作、發起團課、關於、FAQ）用這個外框：訪客→公開 header＋footer，
// 已登入→依 signedInArea 套學員／老師／上次身分的專區外框。只決定外框，不做任何權限判斷。
export async function SiteShell({
  signedInArea,
  publicMainClassName,
  signedInClassName = "flex flex-col gap-8",
  children,
}: {
  signedInArea: SignedInArea;
  publicMainClassName: string;
  signedInClassName?: string;
  children: ReactNode;
}) {
  const session = await auth();

  if (session?.user) {
    const content = <div className={signedInClassName}>{children}</div>;

    if (signedInArea === "teacher") return <TeacherShell>{content}</TeacherShell>;
    if (signedInArea === "last-role") return <LastRoleShell>{content}</LastRoleShell>;

    return <MemberShell>{content}</MemberShell>;
  }

  return (
    <div className="flex min-h-screen flex-col bg-cream text-ink">
      <PublicHeader />
      <main className={publicMainClassName}>{children}</main>
      <PublicFooter />
    </div>
  );
}
