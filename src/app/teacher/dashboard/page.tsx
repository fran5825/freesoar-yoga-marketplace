import Link from "next/link";
import { redirect } from "next/navigation";

import { getOwnTeacherProfileApplicationSnapshot } from "@/domain/teacher-profile/service";
import type { TeacherProfileStatus } from "@/domain/teacher-profile/state";
import { requireUser } from "@/lib/auth/session";

type DashboardStatusCopy = {
  label: string;
  title: string;
  body: string;
  actionLabel: string;
  actionHref: string;
  tone: "sky" | "amber" | "emerald" | "gray";
};

const statusCopy: Record<TeacherProfileStatus, DashboardStatusCopy> = {
  draft: {
    label: "Draft",
    title: "你的老師申請草稿正在整理中",
    body: "你可以回到申請頁繼續補齊 TeacherProfile。草稿不會進入 Admin review，也不會出現在 marketplace。",
    actionLabel: "繼續整理申請",
    actionHref: "/teachers/join",
    tone: "sky",
  },
  submitted: {
    label: "Submitted",
    title: "你的老師申請已送出審核",
    body: "目前請等待平台確認。審核期間不需要重複送出，也不會開放 demand response capability。",
    actionLabel: "查看申請內容",
    actionHref: "/teachers/join",
    tone: "amber",
  },
  rejected: {
    label: "Rejected",
    title: "你的老師申請可修正後重新送出",
    body: "請依平台提供的修正方向調整內容。準備好後，可以回到申請頁重新送出審核。",
    actionLabel: "修正並重新送審",
    actionHref: "/teachers/join",
    tone: "amber",
  },
  approved: {
    label: "Approved",
    title: "你的老師資料已通過審核",
    body: "你已具備 marketplace capability，可以瀏覽並回應團體需求、查看已建立的課程、管理你的可授課時間，並編輯你的老師個人資料。",
    actionLabel: "編輯我的資料",
    actionHref: "/teacher/profile",
    tone: "emerald",
  },
  suspended: {
    label: "Suspended",
    title: "你的老師狀態目前暫停中",
    body: "此狀態下不會公開顯示，也不能回應新的 demand request。若需要協助，請聯絡平台管理者。",
    actionLabel: "查看目前資料",
    actionHref: "/teacher/profile",
    tone: "gray",
  },
};

const badgeToneClasses: Record<DashboardStatusCopy["tone"], string> = {
  sky: "bg-sky-100 text-sky-800",
  amber: "bg-amber-100 text-amber-900",
  emerald: "bg-emerald-100 text-emerald-800",
  gray: "bg-gray-100 text-gray-700",
};

export default async function TeacherDashboardPage() {
  try {
    await requireUser();
  } catch {
    redirect("/sign-in");
  }

  const profile = await getOwnTeacherProfileApplicationSnapshot();
  const profileStatus = profile
    ? { profile, copy: statusCopy[profile.status] }
    : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-8 px-6 py-10">
      <header className="grid gap-4 border-b border-gray-200 pb-6">
        <p className="text-sm font-medium text-sky-700">Teacher dashboard</p>
        <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
          <div className="min-w-0">
            <h1 className="text-3xl font-semibold tracking-tight text-gray-950">
              老師狀態中心
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600">
              這裡顯示你的 TeacherProfile 目前狀態與下一步。
            </p>
          </div>
          <Link
            className="rounded border border-gray-300 px-4 py-2 text-center text-sm font-medium text-gray-900 transition hover:bg-gray-50"
            href="/account"
          >
            Account
          </Link>
        </div>
      </header>

      {profileStatus ? (
        <section className="grid gap-6 rounded border border-gray-200 bg-white p-6">
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${badgeToneClasses[profileStatus.copy.tone]}`}
            >
              {profileStatus.copy.label}
            </span>
            <p className="text-sm text-gray-500">
              Last updated: {formatDateTime(profileStatus.profile.updatedAt)}
            </p>
          </div>

          <div className="min-w-0">
            <h2 className="text-2xl font-semibold tracking-tight text-gray-950">
              {profileStatus.copy.title}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600">
              {profileStatus.copy.body}
            </p>
          </div>

          {profileStatus.profile.status === "rejected" ? (
            <div className="min-w-0 rounded border border-amber-200 bg-amber-50 p-4">
              <h3 className="text-sm font-medium text-amber-950">
                平台的退回說明
              </h3>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-amber-900">
                {profileStatus.profile.rejectionReason &&
                profileStatus.profile.rejectionReason.trim().length > 0
                  ? profileStatus.profile.rejectionReason
                  : "平台尚未提供具體說明。你可以先檢查必填欄位並補充教學經歷，準備好後再重新送審。"}
              </p>
            </div>
          ) : null}

          {profileStatus.profile.status === "suspended" ? (
            <div className="min-w-0 rounded border border-gray-200 bg-gray-50 p-4">
              <h3 className="text-sm font-medium text-gray-950">
                平台的暫停說明
              </h3>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-gray-700">
                {profileStatus.profile.suspensionReason &&
                profileStatus.profile.suspensionReason.trim().length > 0
                  ? profileStatus.profile.suspensionReason
                  : "平台尚未提供具體說明。如需協助，請聯絡平台管理者。"}
              </p>
            </div>
          ) : null}

          <div className="grid gap-3 rounded border border-gray-100 bg-gray-50 p-4 text-sm md:grid-cols-2">
            <ReadOnlyItem
              label="Display name"
              value={profileStatus.profile.displayName ?? "尚未填寫"}
            />
            <ReadOnlyItem
              label="Experience"
              value={
                typeof profileStatus.profile.experienceYears === "number"
                  ? `${profileStatus.profile.experienceYears} years`
                  : "尚未填寫"
              }
            />
            <ReadOnlyItem
              label="Specialties"
              value={formatList(profileStatus.profile.specialties)}
            />
            <ReadOnlyItem
              label="Service areas"
              value={formatList(profileStatus.profile.serviceAreas)}
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              className="rounded bg-gray-950 px-5 py-3 text-center text-sm font-medium text-white transition hover:bg-gray-800"
              href={profileStatus.copy.actionHref}
            >
              {profileStatus.copy.actionLabel}
            </Link>
            {profileStatus.profile.status === "approved" ||
            profileStatus.profile.status === "suspended" ? (
              <Link
                className="rounded border border-gray-300 px-5 py-3 text-center text-sm font-medium text-gray-900 transition hover:bg-gray-50"
                href="/teacher/availability"
              >
                管理可授課時間
              </Link>
            ) : null}
          </div>
        </section>
      ) : (
        <section className="grid gap-5 rounded border border-gray-200 bg-white p-6">
          <span className="w-fit rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
            No profile
          </span>
          <div className="min-w-0">
            <h2 className="text-2xl font-semibold tracking-tight text-gray-950">
              你還沒有建立老師申請
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600">
              可以先前往 Teacher Join 頁整理申請草稿。建立草稿不代表送審，也不會公開顯示。
            </p>
          </div>
          <div>
            <Link
              className="inline-flex rounded bg-gray-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-gray-800"
              href="/teachers/join"
            >
              建立 teacher application
            </Link>
          </div>
        </section>
      )}
    </main>
  );
}

function ReadOnlyItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="font-medium text-gray-950">{label}</p>
      <p className="mt-1 break-words leading-6 text-gray-600">{value}</p>
    </div>
  );
}

function formatList(values: string[]) {
  const visibleValues = values.filter((value) => value.trim().length > 0);

  if (visibleValues.length === 0) {
    return "尚未填寫";
  }

  return visibleValues.join(", ");
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("zh-TW", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}
