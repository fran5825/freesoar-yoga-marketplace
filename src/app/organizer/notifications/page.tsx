import { redirect } from "next/navigation";

import { OwnNotificationsContent } from "@/app/notifications/_components/OwnNotificationsContent";
import { requireUser } from "@/lib/auth/session";

// 團主專區裡的「通知」：外框由 /organizer/layout.tsx 提供，點通知不會跳到老師專區。
export default async function OrganizerNotificationsPage() {
  try {
    await requireUser();
  } catch {
    redirect("/sign-in");
  }

  return <OwnNotificationsContent />;
}
