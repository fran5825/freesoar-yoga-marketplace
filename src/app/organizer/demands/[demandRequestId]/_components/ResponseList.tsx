import type { OrganizerFacingResponse } from "@/domain/demand-response/organizer-read-service";

const responseStatusLabels: Record<string, string> = {
  submitted: "已送出",
  shortlisted: "候選中",
  selected: "已選定",
  declined: "未選用",
  withdrawn: "已撤回",
  expired: "已過期",
};

export function ResponseList({
  responses,
}: {
  responses: OrganizerFacingResponse[];
}) {
  return (
    <section className="grid gap-4 rounded border border-gray-200 bg-white p-6">
      <div>
        <h2 className="text-lg font-medium text-gray-950">收到的老師回應</h2>
        <p className="mt-2 text-sm leading-6 text-gray-600">
          以下是老師針對這則需求提交的回應，依送出時間排列。
        </p>
      </div>

      {responses.length === 0 ? (
        <p className="text-sm leading-6 text-gray-600">
          目前還沒有老師回應，之後有回應會顯示在這裡。
        </p>
      ) : (
        <ul className="grid gap-4">
          {responses.map((response) => (
            <li
              className="min-w-0 rounded border border-gray-100 bg-gray-50 p-4"
              key={response.id}
            >
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="min-w-0 break-words text-base font-medium text-gray-950">
                  {response.teacherProfile.displayName ?? "老師"}
                </h3>
                <span className="w-fit rounded-full bg-sky-100 px-3 py-1 text-xs font-medium text-sky-800">
                  {responseStatusLabels[response.status] ?? response.status}
                </span>
              </div>

              {response.teacherProfile.teachingStyle ? (
                <p className="mt-2 min-w-0 break-words text-sm leading-6 text-gray-600">
                  {response.teacherProfile.teachingStyle}
                </p>
              ) : null}

              {response.teacherProfile.specialties.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {response.teacherProfile.specialties.map((specialty) => (
                    <span
                      className="rounded-full border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700"
                      key={specialty}
                    >
                      {specialty}
                    </span>
                  ))}
                </div>
              ) : null}

              <div className="mt-3 min-w-0 rounded border border-gray-200 bg-white p-3">
                <p className="text-xs font-medium text-gray-500">回覆內容</p>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-gray-700">
                  {response.message}
                </p>
              </div>

              {response.proposedTimeSlots.length > 0 ? (
                <p className="mt-2 min-w-0 break-words text-sm leading-6 text-gray-600">
                  <span className="font-medium text-gray-950">可配合時段：</span>
                  {response.proposedTimeSlots.join("、")}
                </p>
              ) : null}

              {response.proposedPrice ? (
                <p className="mt-1 min-w-0 break-words text-xs leading-5 text-gray-500">
                  參考價格：{response.proposedPrice}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
