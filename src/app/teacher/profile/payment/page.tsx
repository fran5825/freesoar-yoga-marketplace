import Link from "next/link";
import { redirect } from "next/navigation";

import { getOwnPaymentSettings } from "@/domain/teacher-profile/payment-settings";
import {
  CONTACT_INFO_MAX_LENGTH,
  PAYMENT_ACCOUNT_INFO_MAX_LENGTH,
} from "@/domain/teacher-profile/payment-settings-limits";
import { requireUser } from "@/lib/auth/session";

import { ProfileTabs } from "../_components/ProfileTabs";
import { updatePaymentSettingsAction } from "./actions";
import { PaymentRulesField } from "./_components/PaymentRulesField";

type PaymentSettingsPageProps = {
  searchParams?: Promise<{ result?: string; message?: string }>;
};

const controlClassName =
  "mt-2 w-full rounded-xl border border-ink/25 bg-white px-3 py-2 text-sm leading-6 text-ink outline-none transition focus:border-pine focus:ring-2 focus:ring-pine/15";

// lightweight-payment-v0（付款計畫 P4）：老師自己填寫的收款帳號、繳費規則與聯絡方式。
// 飛索不經手款項：學員轉帳給老師本人，這裡只是把資訊在正確的時間點讓學員看到。
export default async function TeacherPaymentSettingsPage({ searchParams }: PaymentSettingsPageProps) {
  try {
    await requireUser();
  } catch {
    redirect("/sign-in");
  }

  const [view, resolvedSearchParams] = await Promise.all([getOwnPaymentSettings(), searchParams]);

  const feedback =
    resolvedSearchParams?.result && resolvedSearchParams.message
      ? {
          kind: resolvedSearchParams.result === "success" ? ("success" as const) : ("error" as const),
          message: resolvedSearchParams.message,
        }
      : null;

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-ink">老師資料</h1>
        <ProfileTabs active="payment" />
        <p className="mt-4 max-w-2xl text-sm leading-6 text-ink-soft">
          告訴學員怎麼繳費、有哪些規則，以及怎麼聯絡你。飛索不經手款項，學員會直接轉帳給你。
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

      {view.state === "not_available" ? (
        <section className="grid gap-4 rounded-2xl border border-ink/15 bg-white p-6">
          <h2 className="text-xl font-medium text-ink">通過老師審核後就能設定</h2>
          <p className="text-sm leading-6 text-ink-soft">
            完成老師資格審核後，就可以在這裡填寫收款帳號與繳費規則。
          </p>
          <div>
            <Link
              className="inline-flex rounded-full bg-pine px-5 py-3 text-sm font-medium text-white transition hover:bg-pine-deep"
              href="/teachers/join"
            >
              前往老師申請
            </Link>
          </div>
        </section>
      ) : (
        <form
          action={updatePaymentSettingsAction}
          className="grid gap-6 rounded-2xl border border-ink/15 bg-white p-6"
        >
          <PaymentRulesField defaultValue={view.settings.paymentRulesText} />

          <div>
            <label className="text-sm font-medium text-ink" htmlFor="paymentAccountInfo">
              收款帳號（選填）
            </label>
            <p className="mt-1 text-xs leading-5 text-ink-faint">
              例如銀行代碼、帳號、戶名。學員成功報名後才看得到，不會出現在公開頁面。
            </p>
            <textarea
              className={`${controlClassName} min-h-24`}
              defaultValue={view.settings.paymentAccountInfo}
              id="paymentAccountInfo"
              maxLength={PAYMENT_ACCOUNT_INFO_MAX_LENGTH}
              name="paymentAccountInfo"
              placeholder="例如：（012）台北富邦 1234-5678-9012，戶名：王小明"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-ink" htmlFor="contactInfo">
              聯絡方式（選填）
            </label>
            <p className="mt-1 text-xs leading-5 text-ink-faint">
              例如 Line ID、Instagram 或電話。學員成功報名後才看得到。
            </p>
            <input
              className={controlClassName}
              defaultValue={view.settings.contactInfo}
              id="contactInfo"
              maxLength={CONTACT_INFO_MAX_LENGTH}
              name="contactInfo"
              placeholder="例如：Line ID yoga_amy"
              type="text"
            />
          </div>

          <p className="rounded-xl bg-cream px-4 py-3 text-xs leading-5 text-ink-soft">
            學員報名時看到的是「報名當下」的版本；你之後修改，只影響之後新報名的學員，已報名的人看到的不會改變。
          </p>

          <div>
            <button
              className="inline-flex min-h-11 items-center rounded-full bg-pine px-6 py-3 text-sm font-medium text-white transition hover:bg-pine-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay"
              type="submit"
            >
              儲存
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
