import { redirect } from "next/navigation";

import { OwnNotificationsContent } from "@/app/notifications/_components/OwnNotificationsContent";
import { requireUser } from "@/lib/auth/session";

// 學員專區裡的「通知」：外框由 /member/layout.tsx 提供，比照 /teacher/notifications、
// /organizer/notifications，從學員專區點通知就留在學員專區（signed-in-navigation 決策 3）。
export default async function MemberNotificationsPage() {
  try {
    await requireUser();
  } catch {
    redirect("/sign-in");
  }

  return <OwnNotificationsContent />;
}
