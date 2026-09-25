import { redirect } from "next/navigation";

import { ORGANIZATION_TYPE_OPTIONS } from "@/domain/organizer-profile/organization-type-labels";
import { sanitizeOrganizerReturnPath } from "@/domain/organizer-profile/return-path";
import { getOwnOrganizerContext } from "@/domain/organizer-profile/service";
import { getCurrentUser } from "@/lib/auth/session";

import { saveOrganizerProfileAction } from "./actions";
import {
  OrganizerField,
  organizerInputClassName,
  organizerInputMissingClassName,
} from "./_components/organizer-fields";
import { OrganizerSignupForm } from "./_components/OrganizerSignupForm";

type OrganizerProfilePageProps = {
  searchParams?: Promise<{
    result?: string;
    message?: string;
    next?: string;
  }>;
};

// 2026-09-25 organizer-usability 票 04／05：
// - 還沒有團主資料：一頁填完（顯示名稱、組織、聯絡方式），送出後直接進新需求表單。
// - 已有團主資料：單一卡片、單一「儲存」；頂端標出還缺哪些聯絡資料。
// `next` 是從別頁（例如需求表單）被送來補資料時要回去的頁面，儲存後直接回去。
export default async function OrganizerProfilePage({
  searchParams,
}: OrganizerProfilePageProps) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/sign-in");
  }

  const [organizerContext, resolvedSearchParams] = await Promise.all([
    getOwnOrganizerContext(),
    searchParams,
  ]);

  const next = sanitizeOrganizerReturnPath(resolvedSearchParams?.next);

  const feedback =
    resolvedSearchParams?.result && resolvedSearchParams.message
      ? {
          kind:
            resolvedSearchParams.result === "success"
              ? ("success" as const)
              : ("error" as const),
          message: resolvedSearchParams.message,
        }
      : null;

  const organization = organizerContext?.organization ?? null;
  const missingContactFields = organizerContext
    ? [
        { name: "contactName", label: "聯絡窗口姓名", value: organization?.contactName },
        { name: "contactEmail", label: "聯絡信箱", value: organization?.contactEmail },
        { name: "contactPhone", label: "聯絡電話", value: organization?.contactPhone },
      ].filter((field) => !field.value || field.value.trim().length === 0)
    : [];
  const missingContactNames = new Set(
    missingContactFields.map((field) => field.name),
  );

  return (
    <div className="flex flex-col gap-8">
      <header className="border-b border-ink/15 pb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">
          團主資料
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-soft">
          {organizerContext
            ? "老師與平台會看到這裡的資料；聯絡方式在你送出需求審核時使用。"
            : "填好這一頁就能開始整理團課需求，之後不用再補其他資料。"}
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

      {!organizerContext ? (
        <section className="grid gap-5 rounded-2xl border border-ink/15 bg-white p-6">
          <div>
            <h2 className="text-xl font-semibold text-ink">
              建立你的團主資料
            </h2>
            <p className="mt-2 text-sm leading-6 text-ink-soft">
              每位使用者僅能建立一組團主資料。平台不會事先審核你的身分，需求送出後才會審核。
            </p>
          </div>

          <OrganizerSignupForm
            defaultEmail={currentUser.email ?? ""}
            defaultName={currentUser.name ?? ""}
            next={next}
          />
        </section>
      ) : (
        <section className="grid gap-5 rounded-2xl border border-ink/15 bg-white p-6">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-semibold text-ink">
              {organizerContext.organizerProfile.displayName}
            </h2>
            {missingContactFields.length === 0 ? (
              <span className="w-fit rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800">
                聯絡資料完整
              </span>
            ) : (
              <span className="w-fit rounded-full bg-clay-tint px-3 py-1 text-xs font-medium text-clay-deep">
                還缺 {missingContactFields.length} 項聯絡資料
              </span>
            )}
          </div>

          {missingContactFields.length > 0 ? (
            <div className="rounded-xl border border-clay/25 bg-clay-tint px-4 py-3 text-sm leading-6 text-clay-deep">
              送出需求審核前需要補齊：
              {missingContactFields.map((field) => field.label).join("、")}。
            </div>
          ) : null}

          <form action={saveOrganizerProfileAction} className="grid gap-4">
            {next ? <input name="next" type="hidden" value={next} /> : null}

            <OrganizerField
              hint="讓老師與平台知道怎麼稱呼你或你的團隊窗口。"
              label="團主顯示名稱"
            >
              <input
                className={organizerInputClassName}
                defaultValue={organizerContext.organizerProfile.displayName}
                name="displayName"
                required
                type="text"
              />
            </OrganizerField>
            <OrganizerField label="組織名稱">
              <input
                className={organizerInputClassName}
                defaultValue={organization?.name ?? ""}
                name="name"
                required
                type="text"
              />
            </OrganizerField>
            <OrganizerField label="組織類型">
              <select
                className={organizerInputClassName}
                defaultValue={organization?.type ?? ""}
                name="type"
                required
              >
                <option disabled value="">
                  請選擇組織類型
                </option>
                {ORGANIZATION_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </OrganizerField>
            <OrganizerField label="聯絡窗口姓名">
              <input
                className={
                  missingContactNames.has("contactName")
                    ? organizerInputMissingClassName
                    : organizerInputClassName
                }
                defaultValue={organization?.contactName ?? ""}
                name="contactName"
                placeholder="例如：王小明"
                type="text"
              />
            </OrganizerField>
            <OrganizerField label="聯絡信箱">
              <input
                className={
                  missingContactNames.has("contactEmail")
                    ? organizerInputMissingClassName
                    : organizerInputClassName
                }
                defaultValue={organization?.contactEmail ?? ""}
                name="contactEmail"
                placeholder="例如：organizer@example.com"
                type="email"
              />
            </OrganizerField>
            <OrganizerField label="聯絡電話">
              <input
                className={
                  missingContactNames.has("contactPhone")
                    ? organizerInputMissingClassName
                    : organizerInputClassName
                }
                defaultValue={organization?.contactPhone ?? ""}
                name="contactPhone"
                placeholder="例如：0912-345-678"
                type="tel"
              />
            </OrganizerField>

            <button
              className="w-full rounded-full bg-pine px-5 py-3 text-center text-sm font-medium text-white transition hover:bg-pine-deep sm:w-auto sm:justify-self-start"
              type="submit"
            >
              {next ? "儲存並回到剛剛的頁面" : "儲存"}
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
