import { redirect } from "next/navigation";

// 2026-09-26：「可授課時間」併入「老師資料」成為第一個分頁（/teacher/profile）。
// 保留舊網址並轉址，既有連結與書籤不會壞。
export default function TeacherAvailabilityRedirectPage() {
  redirect("/teacher/profile");
}
