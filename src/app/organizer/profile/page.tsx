import type { ReactNode } from "react";

import Link from "next/link";
import { redirect } from "next/navigation";

import { ORGANIZATION_TYPE_OPTIONS } from "@/domain/organizer-profile/organization-type-labels";
import { getOwnOrganizerContext } from "@/domain/organizer-profile/service";
import { requireUser } from "@/lib/auth/session";

import {
  createOrganizerProfileAction,
  updateOrganizationAction,
  updateOrganizerProfileAction,
} from "./actions";

const inputClassName =
  "mt-2 w-full rounded-xl border border-ink/25 bg-white px-3 py-2 text-sm leading-6 text-ink outline-none transition focus:border-pine focus:ring-2 focus:ring-pine/15";

type OrganizerProfilePageProps = {
  searchParams?: Promise<{
    result?: string;
    message?: string;
  }>;
};

export default async function OrganizerProfilePage({
  searchParams,
}: OrganizerProfilePageProps) {
  try {
    await requireUser();
  } catch {
    redirect("/sign-in");
  }

  const [organizerContext, resolvedSearchParams] = await Promise.all([
    getOwnOrganizerContext(),
    searchParams,
  ]);

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

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-8 px-5 py-10 sm:px-8 sm:py-14">
      <header className="border-b border-ink/15 pb-6">
        <p className="text-sm font-medium text-amber-700">
          Organizer capability
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">
          團主資料
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-soft">
          建立團主資料後，你可以開始整理需求、送出審核，讓平台協助你找到合適的瑜伽老師。
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
              請先建立一組團主顯示名稱與所屬組織，之後即可提出團課需求。每位使用者僅能建立一組團主資料。
            </p>
          </div>

          <form action={createOrganizerProfileAction} className="grid gap-4">
            <Field
              hint="讓老師與平台知道怎麼稱呼你或你的團隊窗口。"
              label="團主顯示名稱"
            >
              <input
                className={inputClassName}
                name="displayName"
                placeholder="例如：王小明 / 陽光瑜伽社"
                required
                type="text"
              />
            </Field>
            <Field
              hint="你所代表的公司、社團、社區或親友揪團名稱。"
              label="組織名稱"
            >
              <input
                className={inputClassName}
                name="organizationName"
                placeholder="例如：陽光科技股份有限公司"
                required
                type="text"
              />
            </Field>
            <Field hint="幫助平台理解這個團體的性質。" label="組織類型">
              <select
                className={inputClassName}
                defaultValue=""
                name="organizationType"
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
            </Field>

            <button
              className="w-full rounded-full bg-pine px-5 py-3 text-center text-sm font-medium text-white transition hover:bg-pine-deep sm:w-auto"
              type="submit"
            >
              建立團主資料
            </button>
          </form>
        </section>
      ) : (
        <>
          <section className="grid gap-4 rounded-2xl border border-ink/15 bg-white p-6">
            <div>
              <span className="w-fit rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800">
                已建立
              </span>
              <h2 className="mt-3 text-xl font-semibold text-ink">
                {organizerContext.organizerProfile.displayName}
              </h2>
            </div>

            <form action={updateOrganizerProfileAction} className="grid gap-3">
              <Field hint="讓老師與平台知道怎麼稱呼你或你的團隊窗口。" label="團主顯示名稱">
                <input
                  className={inputClassName}
                  defaultValue={organizerContext.organizerProfile.displayName}
                  name="displayName"
                  required
                  type="text"
                />
              </Field>
              <button
                className="w-fit rounded-full border border-ink/25 px-4 py-2 text-sm font-medium text-ink transition hover:bg-cream"
                type="submit"
              >
                儲存顯示名稱
              </button>
            </form>

            <div>
              <Link
                className="inline-flex rounded-full border border-ink/25 px-4 py-2 text-sm font-medium text-ink transition hover:bg-cream"
                href="/organizer/demands/new"
              >
                建立新的需求
              </Link>
            </div>
          </section>

          <section className="grid gap-5 rounded-2xl border border-ink/15 bg-white p-6">
            <div>
              <h2 className="text-xl font-semibold text-ink">
                組織資訊
              </h2>
              <p className="mt-2 text-sm leading-6 text-ink-soft">
                聯絡資訊會在你送出需求審核時顯示給平台，請確認齊全；送出需求前系統會再次確認這些欄位是否已完整填寫。
              </p>
            </div>

            <form action={updateOrganizationAction} className="grid gap-4">
              <Field label="組織名稱">
                <input
                  className={inputClassName}
                  defaultValue={organizerContext.organization?.name ?? ""}
                  name="name"
                  required
                  type="text"
                />
              </Field>
              <Field label="組織類型">
                <select
                  className={inputClassName}
                  defaultValue={organizerContext.organization?.type ?? ""}
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
              </Field>
              <Field hint="送出需求審核前必須填寫。" label="聯絡窗口姓名">
                <input
                  className={inputClassName}
                  defaultValue={organizerContext.organization?.contactName ?? ""}
                  name="contactName"
                  placeholder="例如：王小明"
                  type="text"
                />
              </Field>
              <Field hint="送出需求審核前必須填寫。" label="聯絡信箱">
                <input
                  className={inputClassName}
                  defaultValue={
                    organizerContext.organization?.contactEmail ?? ""
                  }
                  name="contactEmail"
                  placeholder="例如：organizer@example.com"
                  type="email"
                />
              </Field>
              <Field hint="送出需求審核前必須填寫。" label="聯絡電話">
                <input
                  className={inputClassName}
                  defaultValue={
                    organizerContext.organization?.contactPhone ?? ""
                  }
                  name="contactPhone"
                  placeholder="例如：0912-345-678"
                  type="tel"
                />
              </Field>

              <button
                className="w-full rounded-full bg-pine px-5 py-3 text-center text-sm font-medium text-white transition hover:bg-pine-deep sm:w-auto"
                type="submit"
              >
                儲存組織資訊
              </button>
            </form>
          </section>
        </>
      )}
    </main>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span className="font-medium text-ink">{label}</span>
      {hint ? (
        <p className="mt-1 text-xs leading-5 text-ink-soft">{hint}</p>
      ) : null}
      {children}
    </label>
  );
}
