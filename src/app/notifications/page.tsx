import { redirect } from "next/navigation";

import { getOwnOrganizerContext } from "@/domain/organizer-profile/service";
import { getOwnTeacherProfileApplicationSnapshot } from "@/domain/teacher-profile/service";
import { requireUser } from "@/lib/auth/session";

import { MemberShell } from "../member/_components/MemberShell";
import { OrganizerShell } from "../organizer/_components/OrganizerShell";
import { TeacherShell } from "../teacher/_components/TeacherShell";

import { OwnNotificationsContent } from "./_components/OwnNotificationsContent";

// 共用的通知網址：學員導覽列與既有通知連結使用。
// 2026-09-26：老師、團主專區的導覽列改連到各自的 /teacher/notifications、/organizer/notifications，
// 從哪個專區點「通知」就留在哪個專區。直接開這個網址時才依身分挑外框（兩種身分都有時以團主為準）。
export default async function NotificationsPage() {
  try {
    await requireUser();
  } catch {
    redirect("/sign-in");
  }

  const [organizerContext, teacherProfile] = await Promise.all([
    getOwnOrganizerContext(),
    getOwnTeacherProfileApplicationSnapshot(),
  ]);

  const content = <OwnNotificationsContent />;

  if (organizerContext) {
    return <OrganizerShell>{content}</OrganizerShell>;
  }

  if (teacherProfile) {
    return <TeacherShell>{content}</TeacherShell>;
  }

  return <MemberShell>{content}</MemberShell>;
}
