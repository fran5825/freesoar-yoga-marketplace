import Link from "next/link";

import { getClassAvailability } from "@/domain/class-session/availability";
import { classDiscoveryWeekday } from "@/domain/class-session/class-discovery-filters";
import type {
  PublicClassListEntry,
  PublicClassSessionListItem,
  PublicSeriesListItem,
  PublicTermListItem,
} from "@/domain/class-session/public-read-service";
import { formatTaipeiDatetime, formatTaipeiShortDatetime } from "@/domain/class-session/timezone";
import { classDetailHref, seriesDetailHref, termDetailHref } from "@/lib/navigation/class-return-path";

import { CardCover, TeacherByline, yogaStyleLabel } from "./ClassCover";
import { ClassOriginTag } from "./ClassOriginTag";

// 找課程與老師公開頁共用的課程卡片列表。
export function ClassListEntries({ entries, returnTo }: { entries: PublicClassListEntry[]; returnTo: string }) {
  return (
    <>
      {entries.map((entry) =>
        entry.kind === "term" ? (
          <TermCard key={`term-${entry.item.id}`} returnTo={returnTo} term={entry.item} />
        ) : entry.kind === "series" ? (
          <SeriesCard key={`series-${entry.item.id}`} returnTo={returnTo} series={entry.item} />
        ) : (
          <SessionCard key={entry.item.id} returnTo={returnTo} session={entry.item} />
        ),
      )}
    </>
  );
}

// teacher-showcase-photos 票 05（spec 第 5 節）：卡片只比原本多一張圖的高度，不多出任何資訊行。
// 上方是固定 3:2 的封面區（沒有封面顯示品牌色塊），下方只留：課名（最多兩行）、一行時間、一行地點、
// 一行名額提示，以及老師小頭像加名字。瑜伽類型併入封面區的標籤，不再單獨佔一行。
const cardClassName = "grid min-w-0 overflow-hidden rounded-2xl border border-ink/15 bg-white transition hover:border-pine/40 focus-visible:outline-2 focus-visible:outline-pine";
const cardBodyClassName = "grid min-w-0 content-start gap-1.5 p-4";
const cardTitleClassName = "line-clamp-2 break-words text-lg font-medium leading-6 text-ink sm:min-h-12";

function TermCard({ term, returnTo }: { term: PublicTermListItem; returnTo: string }) {
  return (
    <Link className={cardClassName} href={termDetailHref(term.id, returnTo)}>
      <CardCover
        styleLabel={yogaStyleLabel(term.yogaStyles)}
        tags={
          <>
            <span className="rounded-full bg-pine-tint px-3 py-1 text-xs font-medium text-pine-deep">期班・共 {term.totalCount} 堂・剩 {term.remainingCount} 堂</span>
            {term.canEnroll ? null : <span className="rounded-full bg-cream px-3 py-1 text-xs font-medium text-ink-soft">目前無法報名</span>}
          </>
        }
        url={term.coverUrl}
      />
      <div className={cardBodyClassName}>
        <h2 className={cardTitleClassName}>{term.title}</h2>
        <p className="truncate text-sm text-ink">{term.scheduleLabel}</p>
        <p className="truncate text-sm text-ink-soft">{term.location}</p>
        <p className="truncate text-sm font-medium text-pine">下一堂 {formatTaipeiShortDatetime(term.nextStartAt)}・{term.termEnrollmentMode === "term_only" ? "只收整期" : "整期或單堂"}{term.requiresApproval ? "・需確認" : ""}</p>
        <div className="mt-1 text-sm text-ink-soft"><TeacherByline avatarUrl={term.teacherAvatarUrl} name={term.teacherProfile.displayName ?? "老師"} /></div>
      </div>
    </Link>
  );
}

function SeriesCard({ series, returnTo }: { series: PublicSeriesListItem; returnTo: string }) {
  return (
    <Link className={cardClassName} href={seriesDetailHref(series.id, returnTo)}>
      <CardCover
        styleLabel={yogaStyleLabel(series.yogaStyles)}
        tags={<><ClassOriginTag origin={series.origin} /><span className="rounded-full bg-pine-tint px-3 py-1 text-xs font-medium text-pine-deep">持續開課</span></>}
        url={series.coverUrl}
      />
      <div className={cardBodyClassName}>
        <h2 className={cardTitleClassName}>{series.title}</h2>
        <p className="truncate text-sm text-ink">{series.scheduleLabel}</p>
        <p className="truncate text-sm text-ink-soft">{series.location}</p>
        <p className={`truncate text-sm font-medium ${series.nextIsFull ? "text-ink-soft" : "text-pine"}`}>
          {series.nextIsFull ? `最近一堂 ${formatTaipeiShortDatetime(series.nextStartAt)}・已額滿` : `下一個有名額 ${formatTaipeiShortDatetime(series.nextStartAt)}・剩 ${series.nextRemainingSeats} 個名額`}
        </p>
        <div className="mt-1 text-sm text-ink-soft"><TeacherByline avatarUrl={series.teacherAvatarUrl} name={series.teacherProfile.displayName ?? "老師"} /></div>
      </div>
    </Link>
  );
}

function SessionCard({ session, returnTo }: { session: PublicClassSessionListItem; returnTo: string }) {
  const availability = getClassAvailability({ capacity: session.capacity, activeEnrollmentCount: session.activeEnrollmentCount, startAt: session.startAt });
  const open = availability.state === "open" && session.canAcceptNewEnrollments;
  return (
    <Link className={cardClassName} href={classDetailHref(session.id, returnTo)}>
      <CardCover styleLabel={yogaStyleLabel(session.yogaStyles)} tags={<ClassOriginTag origin={session.origin} />} url={session.coverUrl} />
      <div className={cardBodyClassName}>
        <h2 className={cardTitleClassName}>{session.title}</h2>
        <p className="truncate text-sm text-ink">{formatTaipeiDatetime(session.startAt)}・{classDiscoveryWeekday(session.startAt)}</p>
        <p className="truncate text-sm text-ink-soft">{session.location}</p>
        <p className={`truncate text-sm font-medium ${open ? "text-pine" : "text-ink-soft"}`}>
          {open ? `剩 ${availability.remainingSeats} 個名額` : availability.state === "full" ? "已額滿" : availability.state === "started" ? "已開始" : "目前不開放報名"}
          {session.requiresApproval ? "・需老師確認" : ""}
        </p>
        <div className="mt-1 text-sm text-ink-soft"><TeacherByline avatarUrl={session.teacherAvatarUrl} name={session.teacherProfile.displayName ?? "老師"} /></div>
      </div>
    </Link>
  );
}
