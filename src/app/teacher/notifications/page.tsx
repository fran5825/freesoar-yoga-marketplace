import { redirect } from "next/navigation";

import { OwnNotificationsContent } from "@/app/notifications/_components/OwnNotificationsContent";
import { requireUser } from "@/lib/auth/session";

// 老師專區裡的「通知」：外框由 /teacher/layout.tsx 提供，點通知不會跳到團主專區。
export default async function TeacherNotificationsPage() {
  try {
    await requireUser();
  } catch {
    redirect("/sign-in");
  }

  return <OwnNotificationsContent />;
}
