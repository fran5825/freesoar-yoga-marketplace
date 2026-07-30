import { redirect } from "next/navigation";
import Link from "next/link";

import { getOwnTeacherProfileApplicationSnapshot } from "@/domain/teacher-profile/service";
import { requireUser } from "@/lib/auth/session";

import { updateTeacherProfileAction } from "./actions";

type TeacherProfilePageProps = {
  searchParams?: Promise<{ result?: string; message?: string }>;
};

type NonApprovedStatus = "missing" | "draft" | "submitted" | "rejected";

const nonApprovedCopy: Record<
  NonApprovedStatus,
  { title: string; body: string; actionLabel: string }
> = {
  missing: {
    title: "尚未建立老師申請",
    body: "完成老師資格審核後，就可以在這裡編輯你的個人資料。",
    actionLabel: "前往建立老師申請",
  },
  draft: {
    title: "老師申請還在準備中",
    body: "完成並送出申請、通過審核後，就可以在這裡編輯你的個人資料。",
    actionLabel: "繼續整理申請",
  },
  submitted: {
    title: "老師申請審核中",
    body: "審核期間請耐心等候。通過審核後，就可以在這裡編輯你的個人資料。",
    actionLabel: "查看申請狀態",
  },
  rejected: {
    title: "老師申請可修正後重新送出",
    body: "請前往加入表單依修正方向調整並重新送審。",
    actionLabel: "前往修正申請",
  },
};

const fieldLabels = {
  displayName: "公開顯示名稱",
  bio: "老師簡介",
  teachingStyle: "教學風格",
  experienceYears: "教學年資",
  specialties: "擅長類型",
  serviceAreas: "可服務區域",
  teachingFormats: "授課形式",
  certifications: "證照或訓練背景",
  priceRange: "參考收費區間",
  profilePhotoUrl: "老師照片連結",
} as const;

function toListText(values: string[]) {
  return values.join("\n");
}

function toListDisplay(values: string[]) {
  return values.length > 0 ? values.join("、") : "尚未填寫";
}

export default async function TeacherProfilePage({
  searchParams,
}: TeacherProfilePageProps) {
  try {
    await requireUser();
  } catch {
    redirect("/sign-in");
  }

  const [profile, resolvedSearchParams] = await Promise.all([
    getOwnTeacherProfileApplicationSnapshot(),
    searchParams,
  ]);

  const feedback =
    resolvedSearchParams?.result && resolvedSearchParams.message
      ? {
          kind:
            resolvedSearchParams.result === "success" ? ("success" as const) : ("error" as const),
          message: resolvedSearchParams.message,
        }
      : null;

  if (!profile || (profile.status !== "approved" && profile.status !== "suspended")) {
    const copy =
      nonApprovedCopy[(profile?.status as NonApprovedStatus | undefined) ?? "missing"];

    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-5 py-10 sm:px-8">
        <header className="border-b border-gray-200 pb-6">
          <p className="text-sm font-medium text-sky-700">Teacher profile</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gray-950">
            個人資料
          </h1>
        </header>
        <section className="grid gap-4 rounded border border-gray-200 bg-white p-6">
          <h2 className="text-xl font-medium text-gray-950">{copy.title}</h2>
          <p className="text-sm leading-6 text-gray-600">{copy.body}</p>
          <div>
            <Link
              className="inline-flex rounded bg-gray-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-gray-800"
              href="/teachers/join"
            >
              {copy.actionLabel}
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const isApproved = profile.status === "approved";

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-5 py-10 sm:px-8">
      <header className="border-b border-gray-200 pb-6">
        <p className="text-sm font-medium text-sky-700">Teacher profile</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gray-950">
          個人資料
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600">
          管理團主與平台看到的老師個人資料。
        </p>
      </header>

      {feedback ? (
        <section
          aria-live="polite"
          className={
            feedback.kind === "success"
              ? "rounded border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-900"
              : "rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900"
          }
        >
          {feedback.message}
        </section>
      ) : null}

      {!isApproved ? (
        <section
          aria-live="polite"
          className="rounded border border-gray-200 bg-gray-50 px-4 py-3 text-sm leading-6 text-gray-700"
        >
          帳號目前暫停中，暫時無法編輯個人資料，但你仍然可以查看既有資料。
        </section>
      ) : null}

      {isApproved ? (
        <form
          action={updateTeacherProfileAction}
          className="grid gap-6 rounded border border-gray-200 bg-white p-6"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-gray-950" htmlFor="displayName">
                {fieldLabels.displayName}
              </label>
              <input
                className="mt-2 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm leading-6 text-gray-950 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                defaultValue={profile.displayName ?? ""}
                id="displayName"
                name="displayName"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-950" htmlFor="experienceYears">
                {fieldLabels.experienceYears}
              </label>
              <input
                className="mt-2 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm leading-6 text-gray-950 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                defaultValue={
                  typeof profile.experienceYears === "number" ? profile.experienceYears : ""
                }
                id="experienceYears"
                min={0}
                name="experienceYears"
                required
                type="number"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-950" htmlFor="profilePhotoUrl">
                {fieldLabels.profilePhotoUrl}（選填）
              </label>
              <input
                className="mt-2 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm leading-6 text-gray-950 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                defaultValue={profile.profilePhotoUrl ?? ""}
                id="profilePhotoUrl"
                name="profilePhotoUrl"
                type="url"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-950" htmlFor="priceRange">
                {fieldLabels.priceRange}（選填）
              </label>
              <input
                className="mt-2 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm leading-6 text-gray-950 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                defaultValue={profile.priceRange ?? ""}
                id="priceRange"
                name="priceRange"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-gray-950" htmlFor="bio">
                {fieldLabels.bio}
              </label>
              <textarea
                className="mt-2 min-h-28 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm leading-6 text-gray-950 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                defaultValue={profile.bio ?? ""}
                id="bio"
                name="bio"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-950" htmlFor="teachingStyle">
                {fieldLabels.teachingStyle}
              </label>
              <textarea
                className="mt-2 min-h-28 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm leading-6 text-gray-950 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                defaultValue={profile.teachingStyle ?? ""}
                id="teachingStyle"
                name="teachingStyle"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-950" htmlFor="certifications">
                {fieldLabels.certifications}（選填，可用逗號或換行分隔）
              </label>
              <textarea
                className="mt-2 min-h-28 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm leading-6 text-gray-950 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                defaultValue={toListText(profile.certifications)}
                id="certifications"
                name="certifications"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="text-sm font-medium text-gray-950" htmlFor="specialties">
                {fieldLabels.specialties}（可用逗號或換行分隔）
              </label>
              <textarea
                className="mt-2 min-h-24 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm leading-6 text-gray-950 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                defaultValue={toListText(profile.specialties)}
                id="specialties"
                name="specialties"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-950" htmlFor="serviceAreas">
                {fieldLabels.serviceAreas}（可用逗號或換行分隔）
              </label>
              <textarea
                className="mt-2 min-h-24 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm leading-6 text-gray-950 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                defaultValue={toListText(profile.serviceAreas)}
                id="serviceAreas"
                name="serviceAreas"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-950" htmlFor="teachingFormats">
                {fieldLabels.teachingFormats}（可用逗號或換行分隔）
              </label>
              <textarea
                className="mt-2 min-h-24 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm leading-6 text-gray-950 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                defaultValue={toListText(profile.teachingFormats)}
                id="teachingFormats"
                name="teachingFormats"
                required
              />
            </div>
          </div>

          <button
            className="w-full rounded bg-sky-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-800 sm:w-auto"
            type="submit"
          >
            儲存變更
          </button>
        </form>
      ) : (
        <section className="grid gap-4 rounded border border-gray-200 bg-white p-6 text-sm leading-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <ReadOnlyItem label={fieldLabels.displayName} value={profile.displayName ?? "尚未填寫"} />
            <ReadOnlyItem
              label={fieldLabels.experienceYears}
              value={typeof profile.experienceYears === "number" ? `${profile.experienceYears} 年` : "尚未填寫"}
            />
            <ReadOnlyItem label={fieldLabels.profilePhotoUrl} value={profile.profilePhotoUrl ?? "尚未填寫"} />
            <ReadOnlyItem label={fieldLabels.priceRange} value={profile.priceRange ?? "尚未填寫"} />
          </div>
          <ReadOnlyItem label={fieldLabels.bio} value={profile.bio ?? "尚未填寫"} />
          <ReadOnlyItem label={fieldLabels.teachingStyle} value={profile.teachingStyle ?? "尚未填寫"} />
          <ReadOnlyItem label={fieldLabels.certifications} value={toListDisplay(profile.certifications)} />
          <div className="grid gap-4 sm:grid-cols-3">
            <ReadOnlyItem label={fieldLabels.specialties} value={toListDisplay(profile.specialties)} />
            <ReadOnlyItem label={fieldLabels.serviceAreas} value={toListDisplay(profile.serviceAreas)} />
            <ReadOnlyItem label={fieldLabels.teachingFormats} value={toListDisplay(profile.teachingFormats)} />
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
      <p className="mt-1 whitespace-pre-wrap break-words text-gray-600">{value}</p>
    </div>
  );
}
