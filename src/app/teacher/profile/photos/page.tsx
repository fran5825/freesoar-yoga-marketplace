import Link from "next/link";
import { redirect } from "next/navigation";

import { PHOTO_MAX_BYTES } from "@/domain/teacher-photo/process-image";
import { listOwnTeacherPhotos, TEACHER_PHOTO_MAX_COUNT } from "@/domain/teacher-photo/service";
import { getOwnPublicPageSetting } from "@/domain/teacher-profile/public-page-settings";
import { getOwnTeacherProfileApplicationSnapshot } from "@/domain/teacher-profile/service";
import { requireUser } from "@/lib/auth/session";

import { ConfirmActionDialog } from "../../classes/_components/ConfirmActionDialog";
import { ProfileTabs } from "../_components/ProfileTabs";
import {
  clearAvatarAction,
  deletePhotoAction,
  movePhotoAction,
  setAvatarAction,
  setPublicPageAction,
  uploadPhotoAction,
} from "./actions";

type TeacherPhotosPageProps = {
  searchParams?: Promise<{ result?: string; message?: string }>;
};

const smallButton =
  "inline-flex min-h-11 items-center rounded-full border border-ink/25 bg-white px-4 py-2 text-sm font-medium text-ink-soft transition hover:border-pine hover:text-pine focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay disabled:opacity-50";

// teacher-showcase-photos 票 03（spec S2、S4、S7）：老師的頭像與個人照片，最多 5 張。
// 沒有照片就整塊不顯示在公開頁上（有填才顯示）；這裡只是管理畫面。
export default async function TeacherPhotosPage({ searchParams }: TeacherPhotosPageProps) {
  try {
    await requireUser();
  } catch {
    redirect("/sign-in");
  }

  const [profile, list, publicPage, resolvedSearchParams] = await Promise.all([
    getOwnTeacherProfileApplicationSnapshot(),
    listOwnTeacherPhotos(),
    getOwnPublicPageSetting(),
    searchParams,
  ]);
  const feedback =
    resolvedSearchParams?.result && resolvedSearchParams.message
      ? {
          kind: resolvedSearchParams.result === "success" ? ("success" as const) : ("error" as const),
          message: resolvedSearchParams.message,
        }
      : null;
  const isApproved = profile?.status === "approved";
  const canView = profile?.status === "approved" || profile?.status === "suspended";
  const atLimit = list.photos.length >= TEACHER_PHOTO_MAX_COUNT;

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-ink">老師資料</h1>
        <ProfileTabs active="photos" />
        <p className="mt-4 max-w-2xl text-sm leading-6 text-ink-soft">
          放上你的頭像與教學照片，讓學員更了解你的風格。沒放照片也沒關係，頁面不會出現空白的框。
        </p>
      </header>

      {feedback ? (
        <section
          aria-live="polite"
          className={
            feedback.kind === "success"
              ? "rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-900"
              : "rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900"
          }
        >
          {feedback.message}
        </section>
      ) : null}

      {!canView ? (
        <section className="grid gap-4 rounded-2xl border border-ink/15 bg-white p-6">
          <h2 className="text-xl font-medium text-ink">通過老師審核後就能上傳照片</h2>
          <p className="text-sm leading-6 text-ink-soft">完成老師資格審核後，就可以在這裡放上頭像與教學照片。</p>
          <div>
            <Link
              className="inline-flex rounded-full bg-pine px-5 py-3 text-sm font-medium text-white transition hover:bg-pine-deep"
              href="/teachers/join"
            >
              前往老師申請
            </Link>
          </div>
        </section>
      ) : (
        <>
          {!list.storageConfigured ? (
            <section aria-live="polite" className="rounded-xl border border-ink/15 bg-cream px-4 py-3 text-sm leading-6 text-ink-soft">
              照片功能尚未開通，暫時無法上傳或顯示照片。其他功能不受影響。
            </section>
          ) : null}

          {publicPage.state === "ok" ? (
            <section aria-labelledby="public-page-title" className="grid gap-3 rounded-2xl border border-ink/15 bg-white p-6">
              <h2 className="text-lg font-medium text-ink" id="public-page-title">
                公開我的老師頁
              </h2>
              <p className="text-sm leading-6 text-ink-soft">
                目前：<span className="font-medium text-ink">{publicPage.visible ? "已公開" : "未公開"}</span>
                {publicPage.enabled && !publicPage.visible ? "（帳號暫停期間訪客看不到）" : ""}
              </p>
              <p className="text-xs leading-5 text-ink-faint">
                公開後，任何人（不用登入）都能看到：頭像與照片、簡介、教學風格、證照、擅長類型、授課形式與服務地區，以及你目前公開的課程。
                不會顯示：email、電話、收款帳號與聯絡方式。預設是關閉，你隨時可以關掉。
              </p>
              <div className="flex flex-wrap items-center gap-3">
                {publicPage.canChange ? (
                  <form action={setPublicPageAction}>
                    <input name="enabled" type="hidden" value={publicPage.enabled ? "no" : "yes"} />
                    <button
                      className="inline-flex min-h-11 items-center rounded-full bg-pine px-6 py-3 text-sm font-medium text-white transition hover:bg-pine-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay"
                      type="submit"
                    >
                      {publicPage.enabled ? "關閉公開頁" : "公開我的老師頁"}
                    </button>
                  </form>
                ) : (
                  <p className="text-sm text-ink-soft">帳號暫停期間無法變更。</p>
                )}
                {publicPage.visible ? (
                  <Link className="text-sm font-medium text-pine underline underline-offset-4" href={`/teachers/${publicPage.teacherProfileId}`}>
                    查看我的公開頁
                  </Link>
                ) : null}
              </div>
            </section>
          ) : null}

          <section aria-labelledby="photo-upload-title" className="grid gap-3 rounded-2xl border border-ink/15 bg-white p-6">
            <h2 className="text-lg font-medium text-ink" id="photo-upload-title">
              上傳照片（{list.photos.length} / {TEACHER_PHOTO_MAX_COUNT}）
            </h2>
            {isApproved ? (
              <form action={uploadPhotoAction} className="grid gap-3" encType="multipart/form-data">
                <div>
                  <label className="text-sm font-medium text-ink" htmlFor="photo">
                    選擇照片
                  </label>
                  <input
                    accept="image/jpeg,image/png,image/webp"
                    className="mt-2 block w-full text-sm text-ink-soft file:mr-3 file:rounded-full file:border file:border-ink/25 file:bg-white file:px-4 file:py-2 file:text-sm file:font-medium file:text-ink"
                    disabled={!list.storageConfigured || atLimit}
                    id="photo"
                    name="photo"
                    required
                    type="file"
                  />
                </div>
                <p className="text-xs leading-5 text-ink-faint">
                  JPG、PNG 或 WebP，每張 {PHOTO_MAX_BYTES / 1024 / 1024} MB 以內；上傳後會自動縮成適合網頁的大小。
                  照片裡若有其他學員的臉，請先取得對方同意。
                  {atLimit ? "已經放滿 5 張，請先刪除一張再上傳。" : ""}
                </p>
                <div>
                  <button
                    className="inline-flex min-h-11 items-center rounded-full bg-pine px-6 py-3 text-sm font-medium text-white transition hover:bg-pine-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay disabled:opacity-50"
                    disabled={!list.storageConfigured || atLimit}
                    type="submit"
                  >
                    上傳
                  </button>
                </div>
              </form>
            ) : (
              <p className="text-sm leading-6 text-ink-soft">帳號目前暫停中，暫時無法上傳新照片，但可以查看既有照片。</p>
            )}
          </section>

          {list.photos.length > 0 ? (
            <section aria-labelledby="photo-list-title" className="grid gap-4">
              <h2 className="text-lg font-medium text-ink" id="photo-list-title">
                我的照片
              </h2>
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {list.photos.map((photo, index) => (
                  <li
                    className="grid min-w-0 gap-3 rounded-2xl border border-ink/15 bg-white p-3"
                    data-photo-id={photo.id}
                    key={photo.id}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      alt={`第 ${index + 1} 張照片${photo.isAvatar ? "（頭像）" : ""}`}
                      className="aspect-[3/2] w-full rounded-xl bg-cream object-cover"
                      height={photo.height}
                      src={photo.url}
                      width={photo.width}
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm text-ink-soft">第 {index + 1} 張</span>
                      {photo.isAvatar ? (
                        <span className="rounded-full bg-pine-tint px-3 py-1 text-xs font-medium text-pine-deep">頭像</span>
                      ) : null}
                    </div>
                    {isApproved ? (
                      <div className="flex flex-wrap gap-2">
                        {photo.isAvatar ? (
                          <form action={clearAvatarAction}>
                            <button className={smallButton} type="submit">
                              取消頭像
                            </button>
                          </form>
                        ) : (
                          <form action={setAvatarAction}>
                            <input name="photoId" type="hidden" value={photo.id} />
                            <button className={smallButton} type="submit">
                              設為頭像
                            </button>
                          </form>
                        )}
                        <form action={movePhotoAction}>
                          <input name="photoId" type="hidden" value={photo.id} />
                          <input name="direction" type="hidden" value="up" />
                          <button aria-label={`第 ${index + 1} 張照片往前移`} className={smallButton} disabled={index === 0} type="submit">
                            往前
                          </button>
                        </form>
                        <form action={movePhotoAction}>
                          <input name="photoId" type="hidden" value={photo.id} />
                          <input name="direction" type="hidden" value="down" />
                          <button
                            aria-label={`第 ${index + 1} 張照片往後移`}
                            className={smallButton}
                            disabled={index === list.photos.length - 1}
                            type="submit"
                          >
                            往後
                          </button>
                        </form>
                        <ConfirmActionDialog
                          action={deletePhotoAction}
                          confirmLabel="確定刪除"
                          hiddenFields={{ photoId: photo.id }}
                          title="刪除這張照片？"
                          triggerAriaLabel={`刪除第 ${index + 1} 張照片`}
                          triggerClassName={smallButton}
                          triggerLabel="刪除"
                        >
                          <p>刪除後，這張照片會從所有頁面消失，無法復原。</p>
                          {photo.coverUsage.sessions + photo.coverUsage.series > 0 ? (
                            <p>
                              這張照片目前是{coverUsageText(photo.coverUsage)}的封面，刪除後這些課程會改用品牌色塊，課程本身不受影響。
                            </p>
                          ) : null}
                          {photo.isAvatar ? <p>這張是你的頭像，刪除後就沒有頭像了。</p> : null}
                        </ConfirmActionDialog>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}

function coverUsageText(usage: { sessions: number; series: number }): string {
  const parts = [
    usage.sessions > 0 ? `${usage.sessions} 堂單堂課` : null,
    usage.series > 0 ? `${usage.series} 個系列` : null,
  ].filter((part): part is string => part !== null);

  return parts.join("與 ");
}
