import Link from "next/link";

import { formatTaipeiShortDatetime } from "@/domain/class-session/timezone";
import type { TermDetail } from "@/domain/enrollment/term-read-service";

import { SignInOptions } from "../../_components/sign-in-options";
import { enrollFromTermClassAction, signInToEnrollAction } from "../[classSessionId]/actions";
import { EnrollReveal, OptionalNotes } from "./EnrollReveal";

// teacher-class-scheduling 票 14（Q2、Q3、Q10、Q12）：屬於期班、而且還沒報名這一堂時的單堂頁報名區。
// 原本「這堂課屬於期班」與「報名這堂課程」兩張卡合成這一張：說明屬於哪個期班，「我要報名」展開後
// 二選一（報名整期／只報這一堂，預設整期；只有一個能選時只顯示那一個），結果也顯示在這張卡。
// 只收整期的期班不會走到這裡（未報名者已轉到期班頁）。
const buttonClass =
  "inline-flex min-h-11 w-full items-center justify-center rounded-full bg-pine px-5 py-3 text-center text-sm font-medium text-white hover:bg-pine-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay sm:w-fit";

export function TermClassEnrollPanel({
  classSession,
  term,
  termDetail,
  signedIn,
  returnTo,
  openForm,
  feedback,
}: {
  classSession: { id: string; canAcceptNewEnrollments: boolean; requiresApproval: boolean };
  term: { id: string; title: string; totalCount: number };
  termDetail: TermDetail | null;
  signedIn: boolean;
  returnTo: string;
  openForm: boolean;
  feedback: { success: boolean; message: string } | null;
}) {
  const termAvailable = Boolean(termDetail && !termDetail.termEnrollBlock && !termDetail.ownSeriesEnrollment);
  const singleAvailable = classSession.canAcceptNewEnrollments;
  const remaining = termDetail?.remainingCount ?? term.totalCount;

  return (
    <section aria-labelledby="enrollment-heading" className="scroll-mt-6 grid gap-4 rounded-2xl border border-pine/25 bg-white p-5 sm:p-6" id="enroll">
      <h2 className="text-lg font-medium text-ink" id="enrollment-heading">
        報名
      </h2>
      <p className="text-sm leading-6 text-ink-soft">
        這堂課屬於期班「
        <Link className="font-medium text-pine underline" href={`/classes/terms/${term.id}`}>
          {term.title}
        </Link>
        」，這一期共 {term.totalCount} 堂；可以報整期，也可以只報這一堂。
      </p>
      {feedback ? (
        <p
          aria-live="polite"
          className={
            feedback.success
              ? "rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-900"
              : "rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900"
          }
        >
          {feedback.message}
          {feedback.success ? (
            <>
              {" "}
              <Link className="font-medium underline" href="/member/enrollments">
                查看我的報名
              </Link>
            </>
          ) : null}
        </p>
      ) : null}
      {!termAvailable && !singleAvailable ? (
        <p className="text-sm leading-6 text-ink-soft">
          {termDetail?.ownSeriesEnrollment
            ? "你已經有這一期的整期報名，到期班頁查看。"
            : termDetail?.termEnrollBlock?.reason === "session_full"
              ? `${formatTaipeiShortDatetime(termDetail.termEnrollBlock.startAt)} 那一堂已經額滿，暫時不能報整期；這一堂目前也無法報名。`
              : "這堂課目前無法報名，也不能報整期。你可以看看其他課程。"}
        </p>
      ) : (
        <EnrollReveal defaultOpen={openForm} hint={classSession.requiresApproval ? "需老師確認" : "送出即成立"}>
          {!signedIn ? (
            <>
              <p className="text-sm leading-6 text-ink-soft">
                登入後選擇報整期或只報這一堂。第一次使用會自動建立帳號；登入後回到這裡，由你確認後才會送出。
              </p>
              <SignInOptions
                action={signInToEnrollAction}
                buttonClassName={buttonClass}
                fields={{ classSessionId: classSession.id, returnTo, openForm: "1" }}
                label={(provider) => `使用 ${provider} 登入並報名`}
              />
            </>
          ) : (
            <form action={enrollFromTermClassAction} className="grid gap-4">
              <input name="classSessionId" type="hidden" value={classSession.id} />
              <input name="recurringClassSeriesId" type="hidden" value={term.id} />
              <input name="returnTo" type="hidden" value={returnTo} />
              {termAvailable && singleAvailable ? (
                <fieldset className="grid gap-2">
                  <legend className="mb-2 text-sm font-medium text-ink">要報名哪一種？</legend>
                  <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-ink/20 px-4 py-3 text-sm has-[:checked]:border-pine has-[:checked]:bg-pine-tint">
                    <input className="mt-1 accent-pine" defaultChecked name="choice" type="radio" value="term" />
                    <span>
                      <span className="block font-medium text-ink">報名整期（{remaining} 堂）</span>
                      <span className="block text-ink-soft">報上這一期剩下的每一堂。</span>
                    </span>
                  </label>
                  <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-ink/20 px-4 py-3 text-sm has-[:checked]:border-pine has-[:checked]:bg-pine-tint">
                    <input className="mt-1 accent-pine" name="choice" type="radio" value="single" />
                    <span>
                      <span className="block font-medium text-ink">只報這一堂</span>
                      <span className="block text-ink-soft">之後想報其他堂，可以再個別報名。</span>
                    </span>
                  </label>
                </fieldset>
              ) : (
                <>
                  <input name="choice" type="hidden" value={termAvailable ? "term" : "single"} />
                  <p className="text-sm leading-6 text-ink-soft">
                    {termAvailable
                      ? `這一堂目前無法單獨報名；可以報名整期（${remaining} 堂）。`
                      : "這一期目前不能報整期；可以只報這一堂。"}
                  </p>
                </>
              )}
              <OptionalNotes id="notes" />
              <label className="flex items-start gap-3 text-sm leading-6 text-ink-soft">
                <input className="mt-1 size-4 shrink-0 accent-pine" name="basicConsent" required type="checkbox" value="yes" />
                我了解此課程非醫療行為，會依自身身體狀況參與。
              </label>
              <button className={buttonClass} type="submit">
                {classSession.requiresApproval ? "送出報名申請" : "確認報名"}
              </button>
            </form>
          )}
        </EnrollReveal>
      )}
    </section>
  );
}
