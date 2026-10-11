import Link from "next/link";

import { getClassAvailability } from "@/domain/class-session/availability";
import { formatTaipeiShortDatetime } from "@/domain/class-session/timezone";
import type { TermDetail } from "@/domain/enrollment/term-read-service";

import { SignInOptions } from "../../_components/sign-in-options";
import { enrollAction, enrollFromTermClassAction, signInToEnrollAction } from "../[classSessionId]/actions";
import { EnrollReveal, OptionalNotes } from "./EnrollReveal";

// inline-member-enroll 票 08（spec Q4）：沒報名的人在單堂頁，報名區放在第一張課程資訊卡最上方，
// 取代原本獨立的「報名這堂課程」卡與期班合併報名卡。按「我要報名」（需確認的課程為「申請報名」）才展開表單；
// 期班的單堂頁展開後先二選一（報整期／只報這一堂，預設整期；只有一個能選時只顯示那一個）。
// 登入回來、手機底部按鈕帶回來、或送出失敗時，伺服器傳入 openForm，表單直接展開，仍由本人勾選同意後送出。
const buttonClass =
  "inline-flex min-h-11 w-full items-center justify-center rounded-full bg-pine px-5 py-3 text-center text-sm font-medium text-white hover:bg-pine-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay sm:w-fit";

const consent = (
  <label className="flex items-start gap-3 text-sm leading-6 text-ink-soft">
    <input className="mt-1 size-4 shrink-0 accent-pine" name="basicConsent" required type="checkbox" value="yes" />
    我了解此課程非醫療行為，會依自身身體狀況參與。
  </label>
);

type CardSession = {
  id: string;
  canAcceptNewEnrollments: boolean;
  requiresApproval: boolean;
  startAt: Date;
  capacity: number;
  activeEnrollmentCount: number;
};

export function ClassCardEnroll({
  classSession,
  signedIn,
  returnTo,
  openForm,
  term,
  termDetail,
}: {
  classSession: CardSession;
  signedIn: boolean;
  returnTo: string;
  openForm: boolean;
  term: { id: string; title: string; totalCount: number } | null;
  termDetail: TermDetail | null;
}) {
  if (term) {
    return (
      <TermChoice
        classSession={classSession}
        openForm={openForm}
        returnTo={returnTo}
        signedIn={signedIn}
        term={term}
        termDetail={termDetail}
      />
    );
  }

  if (!classSession.canAcceptNewEnrollments) {
    const availability = getClassAvailability(classSession);

    return (
      <div className="grid gap-2">
        <p className="text-sm leading-6 text-ink-soft">
          {availability.state === "started"
            ? "這堂課程目前無法報名，可能已經開始。"
            : availability.state === "full"
              ? "這堂課名額已滿。"
              : "這堂課目前不開放報名。"}
        </p>
        <Link className="w-fit py-2 text-sm text-clay underline" href={returnTo}>
          看看其他課程
        </Link>
      </div>
    );
  }

  return (
    <EnrollReveal
      defaultOpen={openForm}
      hint={classSession.requiresApproval ? "需老師確認" : "送出即成立"}
      label={classSession.requiresApproval ? "申請報名" : "我要報名"}
    >
      {!signedIn ? (
        <>
          <p className="text-sm leading-6 text-ink-soft">
            登入後即可{classSession.requiresApproval ? "送出報名申請，需老師確認才算成立" : "直接報名這堂課程"}。第一次使用會自動建立帳號；登入後會回到這堂課，要由你確認後才會送出報名。
          </p>
          <SignInOptions
            action={signInToEnrollAction}
            buttonClassName={buttonClass}
            fields={{ classSessionId: classSession.id, returnTo, openForm: "1" }}
            label={(provider) => `使用 ${provider} 登入並報名`}
          />
        </>
      ) : (
        <form action={enrollAction} className="grid gap-4">
          <input name="classSessionId" type="hidden" value={classSession.id} />
          <input name="returnTo" type="hidden" value={returnTo} />
          {classSession.requiresApproval ? <p className="text-sm leading-6 text-ink-soft">送出後會等待老師確認，請到「通知」查看結果。</p> : null}
          <OptionalNotes id="notes" />
          {consent}
          <button className={buttonClass} type="submit">
            {classSession.requiresApproval ? "送出報名申請" : "確認報名"}
          </button>
        </form>
      )}
    </EnrollReveal>
  );
}

function TermChoice({
  classSession,
  term,
  termDetail,
  signedIn,
  returnTo,
  openForm,
}: {
  classSession: CardSession;
  term: { id: string; title: string; totalCount: number };
  termDetail: TermDetail | null;
  signedIn: boolean;
  returnTo: string;
  openForm: boolean;
}) {
  const termAvailable = Boolean(termDetail && !termDetail.termEnrollBlock && !termDetail.ownSeriesEnrollment);
  const singleAvailable = classSession.canAcceptNewEnrollments;
  const remaining = termDetail?.remainingCount ?? term.totalCount;

  return (
    <div className="grid gap-3">
      <p className="text-sm leading-6 text-ink-soft">
        這堂課屬於期班「
        <Link className="font-medium text-pine underline" href={`/classes/terms/${term.id}`}>
          {term.title}
        </Link>
        」，這一期共 {term.totalCount} 堂；可以報整期，也可以只報這一堂。
      </p>
      {!termAvailable && !singleAvailable ? (
        <p className="text-sm leading-6 text-ink-soft">
          {termDetail?.ownSeriesEnrollment
            ? "你已經有這一期的整期報名，到期班頁查看。"
            : termDetail?.termEnrollBlock?.reason === "session_full"
              ? `${formatTaipeiShortDatetime(termDetail.termEnrollBlock.startAt)} 那一堂已經額滿，暫時不能報整期；這一堂目前也無法報名。`
              : "這堂課目前無法報名，也不能報整期。你可以看看其他課程。"}
        </p>
      ) : (
        <EnrollReveal defaultOpen={openForm} hint={classSession.requiresApproval ? "需老師確認" : "送出即成立"} label="我要報名">
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
                    {termAvailable ? `這一堂目前無法單獨報名；可以報名整期（${remaining} 堂）。` : "這一期目前不能報整期；可以只報這一堂。"}
                  </p>
                </>
              )}
              <OptionalNotes id="notes" />
              {consent}
              <button className={buttonClass} type="submit">
                {classSession.requiresApproval ? "送出報名申請" : "確認報名"}
              </button>
            </form>
          )}
        </EnrollReveal>
      )}
    </div>
  );
}
