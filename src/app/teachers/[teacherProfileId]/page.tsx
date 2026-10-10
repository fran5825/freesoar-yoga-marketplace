import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { parseClassDiscoveryFilters } from "@/domain/class-session/class-discovery-filters";
import { getPublicClassListEntries } from "@/domain/class-session/public-read-service";
import { getPublicTeacherPage } from "@/domain/teacher-profile/public-page";

import { SiteShell } from "../../_components/site-shell";
import { ClassListEntries } from "../../classes/_components/ClassListCards";

// teacher-showcase-photos 票 06（spec S6、6.2、6.6–6.8）：老師公開頁。
// 老師自己選擇公開、且審核通過才看得到；其餘一律 404（不透露是未公開、暫停還是不存在）。
// 有填才顯示：沒填的欄位整塊不出現，不留空框、不寫「尚未提供」。
type Params = { params: Promise<{ teacherProfileId: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { teacherProfileId } = await params;
  const page = await getPublicTeacherPage(teacherProfileId);

  return { title: page ? page.displayName : "老師" };
}

const sectionClass = "min-w-0 rounded-2xl border border-ink/15 bg-white p-5 sm:p-6";

export default async function PublicTeacherPage({ params }: Params) {
  const { teacherProfileId } = await params;
  const page = await getPublicTeacherPage(teacherProfileId);

  if (!page) {
    notFound();
  }

  // 目前公開、尚未開始的課程（含已額滿，讓學員知道這位老師還有開課）。
  const { filters } = parseClassDiscoveryFilters({ includeFull: "1" });
  const entries = await getPublicClassListEntries({ teacherProfileId: page.id, discovery: filters });
  const facts = [
    page.experienceLabel ? { label: "教學年資", value: page.experienceLabel } : null,
    page.teachingFormats.length > 0 ? { label: "授課形式", value: page.teachingFormats.join("、") } : null,
    page.serviceAreas.length > 0 ? { label: "可服務區域", value: page.serviceAreas.join("、") } : null,
  ].filter((fact): fact is { label: string; value: string } => fact !== null);

  return (
    <SiteShell publicMainClassName="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-5 py-8 sm:px-8" signedInArea="member">
      <header className="flex min-w-0 flex-wrap items-center gap-5 border-b border-ink/15 pb-6">
        {page.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt={`${page.displayName} 的頭像`} className="size-24 shrink-0 rounded-full bg-pine-tint object-cover sm:size-28" src={page.avatarUrl} />
        ) : null}
        <div className="min-w-0">
          <p className="text-sm text-ink-faint">老師</p>
          <h1 className="min-w-0 break-words text-3xl font-semibold tracking-tight text-ink">{page.displayName}</h1>
          {page.specialties.length > 0 ? (
            <ul aria-label="擅長類型" className="mt-3 flex flex-wrap gap-2">
              {page.specialties.map((specialty) => (
                <li className="rounded-full border border-ink/15 px-3 py-0.5 text-xs text-ink-soft" key={specialty}>
                  {specialty}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </header>

      {page.bio ? (
        <section aria-labelledby="teacher-bio-heading" className={sectionClass}>
          <h2 className="text-lg font-medium text-ink" id="teacher-bio-heading">關於我</h2>
          <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-ink-soft">{page.bio}</p>
        </section>
      ) : null}

      {page.teachingStyle ? (
        <section aria-labelledby="teacher-style-heading" className={sectionClass}>
          <h2 className="text-lg font-medium text-ink" id="teacher-style-heading">教學風格</h2>
          <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-ink-soft">{page.teachingStyle}</p>
        </section>
      ) : null}

      {page.photos.length > 0 ? (
        <section aria-labelledby="teacher-photos-heading" className={sectionClass}>
          <h2 className="text-lg font-medium text-ink" id="teacher-photos-heading">照片</h2>
          <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {page.photos.map((photo, index) => (
              <li className="min-w-0" key={photo.id}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt={`${page.displayName} 的照片 ${index + 1}`}
                  className="aspect-[3/2] w-full rounded-xl bg-pine-tint object-cover"
                  height={photo.height}
                  loading="lazy"
                  src={photo.url}
                  width={photo.width}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {page.certifications.length > 0 || facts.length > 0 ? (
        <section aria-labelledby="teacher-facts-heading" className={sectionClass}>
          <h2 className="text-lg font-medium text-ink" id="teacher-facts-heading">資歷與授課方式</h2>
          <dl className="mt-3 grid gap-4 text-sm sm:grid-cols-2">
            {facts.map((fact) => (
              <div className="min-w-0" key={fact.label}>
                <dt className="text-ink-faint">{fact.label}</dt>
                <dd className="mt-1 break-words text-ink">{fact.value}</dd>
              </div>
            ))}
            {page.certifications.length > 0 ? (
              <div className="min-w-0 sm:col-span-2">
                <dt className="text-ink-faint">證照或訓練背景</dt>
                <dd className="mt-1 break-words text-ink">
                  <ul className="grid gap-1">
                    {page.certifications.map((certification) => (
                      <li key={certification}>{certification}</li>
                    ))}
                  </ul>
                </dd>
              </div>
            ) : null}
          </dl>
        </section>
      ) : null}

      <section aria-labelledby="teacher-classes-heading" className="grid gap-4">
        <h2 className="text-lg font-medium text-ink" id="teacher-classes-heading">目前開放的課程</h2>
        {entries.length === 0 ? (
          <p className="rounded-2xl border border-ink/15 bg-white p-5 text-sm leading-6 text-ink-soft sm:p-6">
            目前沒有公開的課程。你可以先到
            <Link className="mx-1 font-medium text-pine underline" href="/classes">
              找課程
            </Link>
            看看其他老師的課。
          </p>
        ) : (
          <div aria-label="這位老師的課程" className="grid gap-4 sm:grid-cols-2" role="region">
            <ClassListEntries entries={entries} returnTo={`/teachers/${page.id}`} />
          </div>
        )}
      </section>
    </SiteShell>
  );
}
