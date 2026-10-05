import Link from "next/link";

import {
  getOrganizerIntentHref,
  isOrganizerIntentPublic,
  type OrganizerIntent,
} from "@/domain/organizer-profile/intent";

type Viewer = Parameters<typeof getOrganizerIntentHref>[1];

const cards: {
  intent: OrganizerIntent;
  title: string;
  description: string;
  action: string;
}[] = [
  {
    intent: "find_teacher",
    title: "我需要找老師",
    description:
      "把上課人數、時段與地點整理成需求，平台審核後公開給合適的老師，再從回應中選擇合作的老師。",
    action: "整理需求、找老師",
  },
  {
    intent: "direct_class",
    title: "我已有合作老師",
    description:
      "選擇平台上的合作老師，填好課程安排送出邀請；老師確認後，就能開放團員報名。",
    action: "安排課程、邀請老師",
  },
];

// 票 10：入口的兩張情境卡。連結目的地依身分決定（見 getOrganizerIntentHref），
// 訪客、已登入但還不是團主、已是團主都會走到對應流程的下一步。
export function OrganizerEntryCards({
  viewer,
  headingLevel = "h2",
}: {
  viewer: Viewer;
  headingLevel?: "h2" | "h3";
}) {
  const Heading = headingLevel;
  const visibleCards = cards.filter((card) => isOrganizerIntentPublic(card.intent));

  return (
    <ul className="grid gap-3 md:grid-cols-2 md:gap-4">
      {visibleCards.map((card) => (
        <li key={card.intent}>
          <Link
            className="flex h-full flex-col gap-2 rounded-2xl border border-ink/15 bg-white p-5 sm:gap-3 sm:p-6 transition hover:border-pine/40 hover:bg-sand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay"
            href={getOrganizerIntentHref(card.intent, viewer)}
          >
            <Heading className="text-lg font-semibold text-ink sm:text-xl">{card.title}</Heading>
            <p className="text-sm leading-6 text-ink-soft">{card.description}</p>
            <span className="mt-auto inline-flex w-fit rounded-full bg-pine px-4 py-1.5 sm:px-5 sm:py-2 text-sm font-medium text-white">
              {card.action}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
