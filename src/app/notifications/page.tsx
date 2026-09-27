import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/session";

import { LastRoleShell } from "../_components/last-role-shell";

import { OwnNotificationsContent } from "./_components/OwnNotificationsContent";

// 共用的通知網址：學員導覽列與既有通知連結使用。
// 2026-09-26：老師、團主專區的導覽列改連到各自的 /teacher/notifications、/organizer/notifications，
// 從哪個專區點「通知」就留在哪個專區（學員是 /member/notifications）。直接開這個網址（例如舊的
// 通知連結）時，2026-09-27 起改用「上次身分」的外框，不再團主優先（signed-in-navigation 決策 3）。
export default async function NotificationsPage() {
  try {
    await requireUser();
  } catch {
    redirect("/sign-in");
  }

  return (
    <LastRoleShell>
      <OwnNotificationsContent />
    </LastRoleShell>
  );
}
