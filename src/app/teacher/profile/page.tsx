import { redirect } from "next/navigation";
import Link from "next/link";

import {
  EXPERIENCE_YEARS_OPTIONS,
  FREQUENCY_OPTIONS,
  LOCATION_TYPE_OPTIONS,
  matchExperienceYearsOptionValue,
  parseCheckboxGroupValue,
  SERVICE_AREA_OPTIONS,
  SESSION_LENGTH_OPTIONS,
  SPECIALTY_GROUPS,
  TEACHING_FORMAT_GROUPS,
  fieldLabels,
  type OptionGroup,
} from "@/app/teachers/join/_lib/application-fields";
import { formatTeacherRatingSummary } from "@/domain/review/rating-summary";
import { getOwnTeacherRatingSummary } from "@/domain/review/read-service";
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

function toListText(values: string[]) {
  return values.join("\n");
}

function toListDisplay(values: string[]) {
  return values.length > 0 ? values.join("、") : "尚未填寫";
}

const controlClassName =
  "mt-2 w-full rounded-xl border border-ink/25 bg-white px-3 py-2 text-sm leading-6 text-ink outline-none transition focus:border-pine focus:ring-2 focus:ring-pine/15";

// 這頁是純 Server Component（用 <form action> 送出，沒有 client-side state），所以
// 每個複選群組的「其他」欄位維持一直顯示，不做勾選後才展開的互動——不需要為此多開一個
// client island。
function CheckboxGroupFields({
  groups,
  name,
  otherName,
  values,
  otherPlaceholder,
}: {
  groups: OptionGroup[];
  name: string;
  otherName: string;
  values: string[];
  otherPlaceholder: string;
}) {
  const { selectedValues, otherText } = parseCheckboxGroupValue(
    values.join("\n"),
    groups,
  );
  const flatOptions = groups.flatMap((group) => group.options);

  return (
    <div className="mt-2 grid gap-3">
      <div className="flex flex-wrap gap-2">
        {flatOptions.map((option) => (
          <label className="cursor-pointer" key={option.value}>
            <input
              className="peer sr-only"
              defaultChecked={selectedValues.includes(option.value)}
              name={name}
              type="checkbox"
              value={option.value}
            />
            <span className="inline-flex rounded-full border border-ink/20 px-3 py-1.5 text-sm text-ink-soft transition peer-checked:border-pine peer-checked:bg-pine peer-checked:text-white">
              {option.label}
            </span>
          </label>
        ))}
      </div>
      <input
        className={controlClassName}
        defaultValue={otherText}
        name={otherName}
        placeholder={otherPlaceholder}
      />
    </div>
  );
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
        <header className="border-b border-ink/15 pb-6">
          <p className="text-sm font-medium text-clay">Teacher profile</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">
            個人資料
          </h1>
        </header>
        <section className="grid gap-4 rounded-2xl border border-ink/15 bg-white p-6">
          <h2 className="text-xl font-medium text-ink">{copy.title}</h2>
          <p className="text-sm leading-6 text-ink-soft">{copy.body}</p>
          <div>
            <Link
              className="inline-flex rounded-full bg-pine px-5 py-3 text-sm font-medium text-white transition hover:bg-pine-deep"
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
  const ratingSummary = await getOwnTeacherRatingSummary();

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-5 py-10 sm:px-8">
      <header className="border-b border-ink/15 pb-6">
        <p className="text-sm font-medium text-clay">Teacher profile</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">
          個人資料
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-soft">
          管理團主與平台看到的老師個人資料。
        </p>
      </header>

      {feedback ? (
        <section
          aria-live="polite"
          className={
            feedback.kind === "success"
              ? "rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-900"
              : "rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900"
          }
        >
          {feedback.message}
        </section>
      ) : null}

      <section className="rounded-xl border border-ink/15 bg-white px-4 py-3 text-sm">
        <p className="font-medium text-ink">平均評分</p>
        <p className="mt-1 text-ink-soft">
          {ratingSummary ? formatTeacherRatingSummary(ratingSummary) : "尚無評價"}
        </p>
      </section>

      {!isApproved ? (
        <section
          aria-live="polite"
          className="rounded-xl border border-ink/15 bg-cream px-4 py-3 text-sm leading-6 text-ink-soft"
        >
          帳號目前暫停中，暫時無法編輯個人資料，但你仍然可以查看既有資料。
        </section>
      ) : null}

      {isApproved ? (
        <form
          action={updateTeacherProfileAction}
          className="grid gap-6 rounded-2xl border border-ink/15 bg-white p-6"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-ink" htmlFor="displayName">
                {fieldLabels.displayName}
              </label>
              <input
                className="mt-2 w-full rounded-xl border border-ink/25 bg-white px-3 py-2 text-sm leading-6 text-ink outline-none transition focus:border-pine focus:ring-2 focus:ring-pine/15"
                defaultValue={profile.displayName ?? ""}
                id="displayName"
                name="displayName"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium text-ink" htmlFor="experienceYears">
                {fieldLabels.experienceYears}
              </label>
              <select
                className={controlClassName}
                defaultValue={matchExperienceYearsOptionValue(profile.experienceYears)}
                id="experienceYears"
                name="experienceYears"
                required
              >
                <option disabled value="">
                  請選擇
                </option>
                {EXPERIENCE_YEARS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-ink" htmlFor="profilePhotoUrl">
                {fieldLabels.profilePhotoUrl}（選填）
              </label>
              <input
                className="mt-2 w-full rounded-xl border border-ink/25 bg-white px-3 py-2 text-sm leading-6 text-ink outline-none transition focus:border-pine focus:ring-2 focus:ring-pine/15"
                defaultValue={profile.profilePhotoUrl ?? ""}
                id="profilePhotoUrl"
                name="profilePhotoUrl"
                type="url"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-ink" htmlFor="priceRange">
                {fieldLabels.priceRange}（選填）
              </label>
              <input
                className="mt-2 w-full rounded-xl border border-ink/25 bg-white px-3 py-2 text-sm leading-6 text-ink outline-none transition focus:border-pine focus:ring-2 focus:ring-pine/15"
                defaultValue={profile.priceRange ?? ""}
                id="priceRange"
                name="priceRange"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-ink" htmlFor="bio">
                {fieldLabels.bio}
              </label>
              <textarea
                className="mt-2 min-h-28 w-full rounded-xl border border-ink/25 bg-white px-3 py-2 text-sm leading-6 text-ink outline-none transition focus:border-pine focus:ring-2 focus:ring-pine/15"
                defaultValue={profile.bio ?? ""}
                id="bio"
                name="bio"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium text-ink" htmlFor="teachingStyle">
                {fieldLabels.teachingStyle}
              </label>
              <textarea
                className="mt-2 min-h-28 w-full rounded-xl border border-ink/25 bg-white px-3 py-2 text-sm leading-6 text-ink outline-none transition focus:border-pine focus:ring-2 focus:ring-pine/15"
                defaultValue={profile.teachingStyle ?? ""}
                id="teachingStyle"
                name="teachingStyle"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium text-ink" htmlFor="certifications">
                {fieldLabels.certifications}（選填，可用逗號或換行分隔）
              </label>
              <textarea
                className="mt-2 min-h-28 w-full rounded-xl border border-ink/25 bg-white px-3 py-2 text-sm leading-6 text-ink outline-none transition focus:border-pine focus:ring-2 focus:ring-pine/15"
                defaultValue={toListText(profile.certifications)}
                id="certifications"
                name="certifications"
              />
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-3">
            <div>
              <p className="text-sm font-medium text-ink">{fieldLabels.specialties}</p>
              <CheckboxGroupFields
                groups={SPECIALTY_GROUPS}
                name="specialties"
                otherName="specialtiesOther"
                otherPlaceholder="其他你擅長但沒列出的風格"
                values={profile.specialties}
              />
            </div>
            <div>
              <p className="text-sm font-medium text-ink">{fieldLabels.serviceAreas}</p>
              <CheckboxGroupFields
                groups={[{ title: "", options: SERVICE_AREA_OPTIONS }]}
                name="serviceAreas"
                otherName="serviceAreasOther"
                otherPlaceholder="其他縣市或線上教學"
                values={profile.serviceAreas}
              />
            </div>
            <div>
              <p className="text-sm font-medium text-ink">{fieldLabels.teachingFormats}</p>
              <CheckboxGroupFields
                groups={TEACHING_FORMAT_GROUPS}
                name="teachingFormats"
                otherName="teachingFormatsOther"
                otherPlaceholder="其他你提供的授課形式"
                values={profile.teachingFormats}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                className="text-sm font-medium text-ink"
                htmlFor="preferredSessionLengthMinutes"
              >
                {fieldLabels.preferredSessionLengthMinutes}（選填）
              </label>
              <select
                className={controlClassName}
                defaultValue={
                  typeof profile.preferredSessionLengthMinutes === "number"
                    ? String(profile.preferredSessionLengthMinutes)
                    : ""
                }
                id="preferredSessionLengthMinutes"
                name="preferredSessionLengthMinutes"
              >
                <option value="">尚未選擇</option>
                {SESSION_LENGTH_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-ink" htmlFor="preferredFrequency">
                {fieldLabels.preferredFrequency}（選填）
              </label>
              <select
                className={controlClassName}
                defaultValue={profile.preferredFrequency ?? ""}
                id="preferredFrequency"
                name="preferredFrequency"
              >
                <option value="">尚未選擇</option>
                {FREQUENCY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-ink" htmlFor="preferredLocationType">
                {fieldLabels.preferredLocationType}（選填）
              </label>
              <select
                className={controlClassName}
                defaultValue={profile.preferredLocationType ?? ""}
                id="preferredLocationType"
                name="preferredLocationType"
              >
                <option value="">尚未選擇</option>
                {LOCATION_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-ink" htmlFor="preferenceNotes">
                {fieldLabels.preferenceNotes}（選填）
              </label>
              <textarea
                className={`${controlClassName} min-h-20`}
                defaultValue={profile.preferenceNotes ?? ""}
                id="preferenceNotes"
                name="preferenceNotes"
              />
            </div>
          </div>

          <button
            className="w-full rounded-full bg-pine px-4 py-2 text-sm font-medium text-white transition hover:bg-pine-deep sm:w-auto"
            type="submit"
          >
            儲存變更
          </button>
        </form>
      ) : (
        <section className="grid gap-4 rounded-2xl border border-ink/15 bg-white p-6 text-sm leading-6">
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
          <div className="grid gap-4 sm:grid-cols-2">
            <ReadOnlyItem
              label={fieldLabels.preferredSessionLengthMinutes}
              value={
                typeof profile.preferredSessionLengthMinutes === "number"
                  ? `${profile.preferredSessionLengthMinutes} 分鐘`
                  : "尚未填寫"
              }
            />
            <ReadOnlyItem
              label={fieldLabels.preferredFrequency}
              value={profile.preferredFrequency ?? "尚未填寫"}
            />
            <ReadOnlyItem
              label={fieldLabels.preferredLocationType}
              value={profile.preferredLocationType ?? "尚未填寫"}
            />
            <ReadOnlyItem
              label={fieldLabels.preferenceNotes}
              value={profile.preferenceNotes ?? "尚未填寫"}
            />
          </div>
        </section>
      )}
    </main>
  );
}

function ReadOnlyItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="font-medium text-ink">{label}</p>
      <p className="mt-1 whitespace-pre-wrap break-words text-ink-soft">{value}</p>
    </div>
  );
}
