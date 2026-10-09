import Link from "next/link";
import type { MemberFacingClassSession } from "@/domain/enrollment/read-service";
import type { PublicClassSessionDetail } from "@/domain/class-session/public-read-service";
import { getClassAvailability } from "@/domain/class-session/availability";
import type { ReEnrollState } from "@/domain/enrollment/re-enroll-eligibility";
import { CancelEnrollmentForm } from "../../member/_components/CancelEnrollmentForm";
import { EnrollmentStatusBadge } from "../../member/_components/EnrollmentStatusBadge";
import { SignInOptions } from "../../_components/sign-in-options";
import { cancelEnrollmentFromClassAction, enrollAction, signInToEnrollAction } from "../[classSessionId]/actions";

const buttonClass = "inline-flex min-h-11 w-full items-center justify-center rounded-full bg-pine px-5 py-3 text-center text-sm font-medium text-white hover:bg-pine-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay sm:w-fit";

export function ClassEnrollmentPanel({ classSession, signedIn, returnTo }: {
  classSession: PublicClassSessionDetail | MemberFacingClassSession;
  signedIn: boolean;
  returnTo: string;
}) {
  const ownEnrollment = "ownEnrollment" in classSession ? classSession.ownEnrollment : null;
  const reEnroll = ownEnrollment && "reEnroll" in ownEnrollment ? ownEnrollment.reEnroll : null;
  const availability = getClassAvailability(classSession);
  const hasStarted = availability.state === "started";
  const full = availability.state === "full";
  async function cancelWithContext(formData: FormData) {
    "use server";
    formData.set("returnTo", returnTo);
    await cancelEnrollmentFromClassAction(formData);
  }
  return (
    <section id="enroll" aria-labelledby="enrollment-heading" className="scroll-mt-6 grid gap-4 rounded-2xl border border-pine/25 bg-white p-5 sm:p-6">
      <h2 id="enrollment-heading" className="text-lg font-medium text-ink">{ownEnrollment ? "你的報名狀態" : "報名這堂課程"}</h2>
      {ownEnrollment ? <>
        <EnrollmentStatusBadge status={ownEnrollment.status} />
        {ownEnrollment.status === "cancelled" ? <CancelledNotice reEnroll={reEnroll} /> : <p className="text-sm leading-6 text-ink-soft">{ownEnrollment.status === "pending" ? "你的報名已送出，老師確認後才算成立，確認結果會顯示在「通知」。" : "報名已成立，請依課程時間與地點準時參加。"}</p>}
        {"seriesEnrollmentId" in ownEnrollment && ownEnrollment.seriesEnrollmentId ? <p className="text-sm leading-6 text-ink-soft">這一堂屬於你的整期報名。</p> : null}
        {reEnroll?.state === "available" ? <form action={enrollAction} className="grid gap-4">
          <input name="classSessionId" type="hidden" value={classSession.id} />
          <input name="returnTo" type="hidden" value={returnTo} />
          <input name="reEnroll" type="hidden" value="1" />
          {classSession.requiresApproval ? <p className="text-sm leading-6 text-ink-soft">送出後會等待老師確認，請到「通知」查看結果。</p> : null}
          <div><label className="text-sm font-medium text-ink" htmlFor="notes">備註（選填）</label><textarea className="mt-2 min-h-20 w-full rounded-xl border border-ink/25 bg-white px-3 py-2 text-sm leading-6 text-ink focus-visible:outline-2 focus-visible:outline-pine" id="notes" maxLength={500} name="notes" /></div>
          <label className="flex items-start gap-3 text-sm leading-6 text-ink-soft"><input className="mt-1 size-4 shrink-0 accent-pine" name="basicConsent" required type="checkbox" value="yes" />我了解此課程非醫療行為，會依自身身體狀況參與。</label>
          <button className={buttonClass} type="submit">{classSession.requiresApproval ? "重新送出報名申請" : "重新報名"}</button>
        </form> : null}
        {["pending", "confirmed"].includes(ownEnrollment.status) && !hasStarted ? <CancelEnrollmentForm action={cancelWithContext} classSessionId={classSession.id} enrollmentId={ownEnrollment.id} variant={"seriesEnrollmentId" in ownEnrollment && ownEnrollment.seriesEnrollmentId ? "leave" : "cancel"} /> : null}
      </> : !classSession.canAcceptNewEnrollments ? <>
        <p className="text-sm leading-6 text-ink-soft">{hasStarted ? "這堂課程目前無法報名，可能已經開始。" : full ? "這堂課名額已滿。你可以回到課程列表看看其他課程。" : "這堂課目前不開放報名。你可以看看其他課程。"}</p>
        <Link className="w-fit py-2 text-sm text-clay underline" href={returnTo}>看看其他課程</Link>
      </> : !signedIn ? <>
        <p className="text-sm leading-6 text-ink-soft">登入後即可{classSession.requiresApproval ? "送出報名申請，需老師確認才算成立" : "直接報名這堂課程"}。第一次使用會自動建立帳號；登入後會回到這堂課，要由你確認後才會送出報名。</p>
        <SignInOptions action={signInToEnrollAction} buttonClassName={buttonClass} fields={{ classSessionId: classSession.id, returnTo }} label={(provider) => `使用 ${provider} 登入並報名`} />
      </> : <form action={enrollAction} className="grid gap-4">
        <input name="classSessionId" type="hidden" value={classSession.id} />
        <input name="returnTo" type="hidden" value={returnTo} />
        {classSession.requiresApproval ? <p className="text-sm leading-6 text-ink-soft">送出後會等待老師確認，請到「通知」查看結果。</p> : null}
        <div><label className="text-sm font-medium text-ink" htmlFor="notes">備註（選填）</label><p className="mt-1 text-xs leading-5 text-ink-soft">例如身體狀況提醒，讓老師與團主更了解你的需求。</p><textarea className="mt-2 min-h-20 w-full rounded-xl border border-ink/25 bg-white px-3 py-2 text-sm leading-6 text-ink focus-visible:outline-2 focus-visible:outline-pine" id="notes" maxLength={500} name="notes" /></div>
        <label className="flex items-start gap-3 text-sm leading-6 text-ink-soft"><input className="mt-1 size-4 shrink-0 accent-pine" name="basicConsent" required type="checkbox" value="yes" />我了解此課程非醫療行為，會依自身身體狀況參與。</label>
        <button className={buttonClass} type="submit">{classSession.requiresApproval ? "送出報名申請" : "確認報名"}</button>
      </form>}
    </section>
  );
}

// enrollment-re-enrollment 票 02（spec 4.6）：已取消的報名依「能不能重新報名」顯示對應說明；可重新報名時表單在上方。
function CancelledNotice({ reEnroll }: { reEnroll: ReEnrollState | null }) {
  const message = (() => {
    switch (reEnroll?.state) {
      case "available": return "你之前取消了這堂課，開課前、名額還在時可以重新報名。";
      case "full": return "這堂課名額已滿，暫時不能重新報名。";
      case "teacher_unavailable": return "這位老師目前無法接受新報名。";
      case "started": return "這筆報名已取消，這堂課程已經開始，無法重新報名。";
      case "blocked":
        if (reEnroll.reason === "teacher") return "老師婉拒了這次報名，無法重新報名。";
        if (reEnroll.reason === "admin") return "這筆報名已由管理員取消，無法重新報名。";
        return "這筆報名已取消，無法再次報名此課程。";
      default: return "這筆報名已取消，無法再次報名此課程。";
    }
  })();

  return <p className="text-sm leading-6 text-ink-soft">{message}</p>;
}
