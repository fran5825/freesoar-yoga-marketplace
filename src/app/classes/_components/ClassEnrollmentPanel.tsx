import Link from "next/link";
import type { PublicClassSessionDetail } from "@/domain/class-session/public-read-service";
import { getClassAvailability } from "@/domain/class-session/availability";
import { SignInOptions } from "../../_components/sign-in-options";
import { enrollAction, signInToEnrollAction } from "../[classSessionId]/actions";

const buttonClass = "inline-flex min-h-11 w-full items-center justify-center rounded-full bg-pine px-5 py-3 text-center text-sm font-medium text-white hover:bg-pine-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay sm:w-fit";

export function ClassEnrollmentPanel({ classSession, signedIn, returnTo }: {
  classSession: PublicClassSessionDetail;
  signedIn: boolean;
  returnTo: string;
}) {
  const availability = getClassAvailability(classSession);
  const hasStarted = availability.state === "started";
  const full = availability.state === "full";
  return (
    <section id="enroll" aria-labelledby="enrollment-heading" className="scroll-mt-6 grid gap-4 rounded-2xl border border-pine/25 bg-white p-5 sm:p-6">
      <h2 id="enrollment-heading" className="text-lg font-medium text-ink">報名這堂課程</h2>
      {!classSession.canAcceptNewEnrollments ? <>
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
