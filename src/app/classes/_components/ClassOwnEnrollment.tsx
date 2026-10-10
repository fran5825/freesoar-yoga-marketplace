import type { MemberFacingClassSession } from "@/domain/enrollment/read-service";
import type { ReEnrollState } from "@/domain/enrollment/re-enroll-eligibility";
import { getClassAvailability } from "@/domain/class-session/availability";

import { CancelEnrollmentForm } from "../../member/_components/CancelEnrollmentForm";
import { EnrollmentStatusBadge } from "../../member/_components/EnrollmentStatusBadge";
import { TermRowAction, TermRowBadge } from "../../member/_components/TermRowControls";
import { cancelEnrollmentFromClassAction, enrollAction } from "../[classSessionId]/actions";

// inline-member-actions 票 03（spec 3.4）：已報名學員在單堂頁，狀態與動作直接放在第一張課程資訊卡裡，
// 取代原本獨立的「你的報名狀態」卡。單堂的取消報名、重新報名與整期的請假、取消請假都是卡內按鈕、就地展開；
// 不能操作時只顯示原因。可否操作全部由 service layer 算好（ownEnrollment.reEnroll／rowControl）。

const buttonClass =
  "inline-flex min-h-11 w-full items-center justify-center rounded-full bg-pine px-5 py-3 text-center text-sm font-medium text-white hover:bg-pine-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay sm:w-fit";

export function ClassOwnEnrollmentStatus({ classSession }: { classSession: MemberFacingClassSession }) {
  const own = classSession.ownEnrollment;

  if (!own) {
    return null;
  }

  const inTerm = own.seriesEnrollmentId !== null;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      {inTerm ? <TermRowBadge control={own.rowControl} status={own.status} /> : <EnrollmentStatusBadge status={own.status} />}
      <p className="min-w-0 text-sm leading-6 text-ink-soft">{statusMessage(classSession)}</p>
    </div>
  );
}

function statusMessage(classSession: MemberFacingClassSession): string {
  const own = classSession.ownEnrollment!;

  if (own.status === "pending") {
    return "你的報名已送出，老師確認後才算成立，確認結果會顯示在「通知」。";
  }

  if (own.status === "confirmed") {
    return own.seriesEnrollmentId ? "報名已成立，這一堂屬於你的整期報名，請依課程時間與地點準時參加。" : "報名已成立，請依課程時間與地點準時參加。";
  }

  return cancelledMessage(own.reEnroll, classSession.termEnrollmentMode);
}

// enrollment-re-enrollment 票 02（spec 4.6）：已取消的報名依「能不能重新報名／取消請假」顯示對應說明。
export function cancelledMessage(reEnroll: ReEnrollState, termMode: "term_only" | "term_and_single" | null): string {
  switch (reEnroll.state) {
    case "available":
      return "你之前取消了這堂課，開課前、名額還在時可以重新報名。";
    case "full":
      return "這堂課名額已滿，暫時不能重新報名。";
    case "leave_available":
      return termMode === "term_only" ? "你這一堂請假中，名額已為你保留，開課前可以取消請假。" : "你這一堂請假中，開課前、名額還在時可以取消請假。";
    case "leave_full":
      return "這一堂名額已被報滿，請聯絡老師。";
    case "teacher_unavailable":
      return "這位老師目前無法接受新報名。";
    case "started":
      return "這筆報名已取消，這堂課程已經開始，無法重新報名。";
    case "blocked":
      if (reEnroll.reason === "teacher") return "老師婉拒了這次報名，無法重新報名。";
      if (reEnroll.reason === "admin") return "這筆報名已由管理員取消，無法重新報名。";
      if (reEnroll.reason === "series_withdrawn") return "你已退出這一期，這一堂無法再報名。";
      if (reEnroll.reason === "series_declined") return "老師婉拒了你的整期報名，這一堂無法再報名。";
      return "這筆報名已取消，無法再次報名此課程。";
    default:
      return "這筆報名已取消，無法再次報名此課程。";
  }
}

export function ClassOwnEnrollmentActions({
  classSession,
  returnTo,
  detailHref,
}: {
  classSession: MemberFacingClassSession;
  // 找課條件的返回路徑（單堂報名動作用）。
  returnTo: string;
  // 這一堂的詳情網址（含找課條件），整期請假等就地操作做完回到這裡。
  detailHref: string;
}) {
  const own = classSession.ownEnrollment;

  if (!own) {
    return null;
  }

  const hasStarted = getClassAvailability(classSession).state === "started";
  const inTerm = own.seriesEnrollmentId !== null;

  async function cancelWithContext(formData: FormData) {
    "use server";
    formData.set("returnTo", returnTo);
    await cancelEnrollmentFromClassAction(formData);
  }

  if (inTerm) {
    return (
      <TermRowAction
        classSessionId={classSession.id}
        control={own.rowControl}
        enrollmentId={own.id}
        returnTo={detailHref}
        termMode={classSession.termEnrollmentMode}
      />
    );
  }

  if ((own.status === "pending" || own.status === "confirmed") && !hasStarted) {
    return <CancelEnrollmentForm action={cancelWithContext} classSessionId={classSession.id} enrollmentId={own.id} variant="cancel" />;
  }

  if (own.status === "cancelled" && own.reEnroll.state === "available") {
    return (
      <details className="relative z-10 rounded-xl border border-pine/25 bg-pine-tint/60" id="re-enroll">
        <summary className="cursor-pointer list-none rounded-full px-4 py-2 text-sm font-medium text-pine marker:hidden">重新報名…</summary>
        <form action={enrollAction} className="grid gap-4 border-t border-pine/15 p-4">
          <input name="classSessionId" type="hidden" value={classSession.id} />
          <input name="returnTo" type="hidden" value={returnTo} />
          <input name="reEnroll" type="hidden" value="1" />
          {classSession.requiresApproval ? <p className="text-sm leading-6 text-ink-soft">送出後會等待老師確認，請到「通知」查看結果。</p> : null}
          <div>
            <label className="text-sm font-medium text-ink" htmlFor="notes">備註（選填）</label>
            <textarea className="mt-2 min-h-20 w-full rounded-xl border border-ink/25 bg-white px-3 py-2 text-sm leading-6 text-ink focus-visible:outline-2 focus-visible:outline-pine" id="notes" maxLength={500} name="notes" />
          </div>
          <label className="flex items-start gap-3 text-sm leading-6 text-ink-soft">
            <input className="mt-1 size-4 shrink-0 accent-pine" name="basicConsent" required type="checkbox" value="yes" />
            我了解此課程非醫療行為，會依自身身體狀況參與。
          </label>
          <button className={buttonClass} type="submit">{classSession.requiresApproval ? "重新送出報名申請" : "重新報名"}</button>
        </form>
      </details>
    );
  }

  return null;
}
