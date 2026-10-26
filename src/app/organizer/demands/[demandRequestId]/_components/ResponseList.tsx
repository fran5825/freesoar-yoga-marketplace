import Link from "next/link";

import type { OrganizerFacingResponse } from "@/domain/demand-response/organizer-read-service";

const responseStatusLabels: Record<string, string> = {
  submitted: "已送出",
  shortlisted: "候選中",
  selected: "已選定",
  declined: "未獲選",
  withdrawn: "已撤回",
  expired: "已過期",
};

export function ResponseList({
  responses,
  demandRequestId,
  organizationContact,
  selectDemandResponseAction,
}: {
  responses: OrganizerFacingResponse[];
  demandRequestId: string;
  // 票 04：需求所屬團體的聯絡資料是否完整，決定老師沒留聯絡方式時要怎麼說。
  organizationContact: { organizationId: string; isContactComplete: boolean } | null;
  selectDemandResponseAction: (formData: FormData) => Promise<void>;
}) {
  // D3/D8：demand 一旦有一筆 selected response，select 是終局動作，不再顯示其他選定表單。
  const hasSelectedResponse = responses.some(
    (response) => response.status === "selected",
  );

  return (
    <section
      className="grid scroll-mt-24 gap-4 rounded-2xl border border-ink/15 bg-white p-6"
      id="responses"
    >
      <div>
        <h2 className="text-lg font-medium text-ink">收到的老師回應</h2>
        <p className="mt-2 text-sm leading-6 text-ink-soft">
          以下是老師針對這則需求提交的回應，依送出時間排列。
        </p>
      </div>

      {responses.length === 0 ? (
        <p className="text-sm leading-6 text-ink-soft">
          目前還沒有老師回應，之後有回應會顯示在這裡。
        </p>
      ) : (
        <ul className="grid gap-4">
          {responses.map((response) => (
            <li
              className="min-w-0 rounded-2xl border border-ink/10 bg-cream p-4"
              key={response.id}
            >
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="min-w-0 break-words text-base font-medium text-ink">
                  {response.teacherProfile.displayName ?? "老師"}
                </h3>
                <span className="w-fit rounded-full bg-pine-tint px-3 py-1 text-xs font-medium text-pine">
                  {responseStatusLabels[response.status] ?? response.status}
                </span>
              </div>

              {response.teacherProfile.teachingStyle ? (
                <p className="mt-2 min-w-0 break-words text-sm leading-6 text-ink-soft">
                  {response.teacherProfile.teachingStyle}
                </p>
              ) : null}

              {response.teacherProfile.specialties.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {response.teacherProfile.specialties.map((specialty) => (
                    <span
                      className="rounded-full border border-ink/15 bg-white px-2 py-1 text-xs text-ink-soft"
                      key={specialty}
                    >
                      {specialty}
                    </span>
                  ))}
                </div>
              ) : null}

              <div className="mt-3 min-w-0 rounded-2xl border border-ink/15 bg-white p-3">
                <p className="text-xs font-medium text-ink-faint">回覆內容</p>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-ink-soft">
                  {response.message}
                </p>
              </div>

              {response.proposedTimeSlots.length > 0 ? (
                <p className="mt-2 min-w-0 break-words text-sm leading-6 text-ink-soft">
                  <span className="font-medium text-ink">可配合時段：</span>
                  {response.proposedTimeSlots.join("、")}
                </p>
              ) : null}

              {response.proposedPrice ? (
                <p className="mt-1 min-w-0 break-words text-xs leading-5 text-ink-faint">
                  參考價格：{response.proposedPrice}
                </p>
              ) : null}

              {response.teacherContact ? (
                <SelectedTeacherContact
                  contactInfo={response.teacherContact.contactInfo}
                  demandRequestId={demandRequestId}
                  organizationContact={organizationContact}
                />
              ) : null}

              {!hasSelectedResponse && response.status === "submitted" ? (
                <details className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/60">
                  <summary className="cursor-pointer list-none rounded-full px-4 py-2 text-sm font-medium text-emerald-800 marker:hidden">
                    選定這位老師…
                  </summary>
                  <form
                    action={selectDemandResponseAction}
                    className="grid gap-3 border-t border-emerald-100 p-4"
                  >
                    <input
                      name="demandRequestId"
                      type="hidden"
                      value={demandRequestId}
                    />
                    <input
                      name="demandResponseId"
                      type="hidden"
                      value={response.id}
                    />
                    <p className="text-sm leading-6 text-ink-soft">
                      選定後，其餘老師的回應會自動標記為未獲選，且無法復原。
                    </p>
                    <label className="flex items-start gap-2 text-sm leading-6 text-ink-soft">
                      <input
                        className="mt-1 shrink-0"
                        name="confirmSelect"
                        required
                        type="checkbox"
                        value="yes"
                      />
                      我確認要選定這位老師。
                    </label>
                    <button
                      className="w-full rounded-full bg-emerald-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-800 sm:w-auto"
                      type="submit"
                    >
                      確認選定
                    </button>
                  </form>
                </details>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// 票 04（spec「聯絡方式」「雙方都沒有聯絡方式」）：選定後，被選定那張卡顯示老師的聯絡方式；
// 老師沒留時依團體聯絡資料是否完整說明，雙方都缺時指出要補團體聯絡資料並回到這筆需求。
function SelectedTeacherContact({
  contactInfo,
  demandRequestId,
  organizationContact,
}: {
  contactInfo: string | null;
  demandRequestId: string;
  organizationContact: { organizationId: string; isContactComplete: boolean } | null;
}) {
  const bothMissing = !contactInfo && organizationContact !== null && !organizationContact.isContactComplete;

  return (
    <div className="mt-3 min-w-0 rounded-2xl border border-pine/20 bg-pine-tint p-3">
      <p className="text-xs font-medium text-pine-deep">老師的聯絡方式</p>
      {contactInfo ? (
        <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-ink [overflow-wrap:anywhere]">{contactInfo}</p>
      ) : bothMissing ? (
        <p className="mt-1 text-sm leading-6 text-ink-soft">
          你和老師目前都沒有可用的聯絡方式。請先補齊團體聯絡資料，老師才聯絡得到你。{" "}
          <Link
            className="font-medium text-pine underline underline-offset-4"
            href={`/organizer/organizations/${organizationContact.organizationId}?returnTo=${encodeURIComponent(`/organizer/demands/${demandRequestId}`)}`}
          >
            補齊團體聯絡資料
          </Link>
        </p>
      ) : (
        <p className="mt-1 text-sm leading-6 text-ink-soft">
          老師還沒留下聯絡方式。老師看得到你團體的聯絡窗口，會主動跟你聯絡確認時間。
        </p>
      )}
    </div>
  );
}
