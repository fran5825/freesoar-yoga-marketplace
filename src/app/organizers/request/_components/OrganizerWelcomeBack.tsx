import Link from "next/link";

// 2026-09-22 organizer-flow-redesign 第 2 批：已經有團主資料的人回到 /organizers/request，
// 不再看招募新團主的文案，改成直接提供「發起新需求」入口（決策二：留在原頁，不 redirect）。
// 組織聯絡資訊不齊時，送出需求會在最後一步被擋（isOrganizationContactComplete），所以在
// 這裡先提醒，免得團主整張表填完才發現送不出去。
export function OrganizerWelcomeBack({
  displayName,
  isContactComplete,
}: {
  displayName: string;
  isContactComplete: boolean;
}) {
  return (
    <section>
      <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
        歡迎回來，{displayName}
      </h1>
      <p className="mt-5 max-w-2xl text-base leading-7 text-ink-soft">
        要幫團體開一堂新的課嗎？整理好需求後，平台審核通過就會讓合適的老師看到。
      </p>

      {isContactComplete ? null : (
        <div className="mt-6 max-w-2xl rounded-xl border border-clay/25 bg-clay-tint px-4 py-3 text-sm leading-6 text-clay-deep">
          送出需求前需要先補齊組織聯絡資訊（聯絡窗口、電話、信箱）。{" "}
          <Link
            className="font-medium underline underline-offset-4"
            href="/organizer/profile"
          >
            前往團主資料補齊
          </Link>
        </div>
      )}

      <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Link
          className="rounded-full bg-pine px-5 py-3 text-center text-sm font-medium text-white transition hover:bg-pine-deep"
          href="/organizer/demands/new"
        >
          發起新需求
        </Link>
        <Link
          className="rounded-full border border-ink/20 px-5 py-3 text-center text-sm font-medium text-ink transition hover:bg-[#efece4]"
          href="/organizer/demands"
        >
          查看我的需求
        </Link>
        <Link
          className="rounded-full border border-ink/20 px-5 py-3 text-center text-sm font-medium text-ink transition hover:bg-[#efece4]"
          href="/organizer/dashboard"
        >
          團主總覽
        </Link>
      </div>
    </section>
  );
}
