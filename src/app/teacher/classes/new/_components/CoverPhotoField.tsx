// teacher-showcase-photos 票 04：建課與改課表單的「課程封面」欄位（選填）。
// 純 HTML、沒有 client state：選一張自己已上傳的照片、不放封面，或直接選檔案上傳新照片（有選檔案就以檔案為準）。
// 沒有照片也沒關係——課程頁會用品牌色塊代替，不會出現空白的框。

export type CoverChoices = {
  storageConfigured: boolean;
  canUpload: boolean;
  photos: { id: string; url: string }[];
};

const optionClass =
  "relative grid min-w-0 cursor-pointer gap-2 rounded-xl border border-ink/20 bg-white p-2 text-sm text-ink-soft transition has-[:checked]:border-pine has-[:checked]:bg-pine-tint/60 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-clay";

export function CoverPhotoField({
  choices,
  currentCoverId = null,
  mode,
  isSeriesSession = false,
  idPrefix = "",
}: {
  choices: CoverChoices | null;
  // 改課時目前的封面（照片 id）；建課時沒有。
  currentCoverId?: string | null;
  mode: "create" | "edit";
  // 改系列場次：封面屬於整個系列。
  isSeriesSession?: boolean;
  idPrefix?: string;
}) {
  // 照片功能沒開通：不提供這個欄位，其他欄位照常。
  if (!choices || !choices.storageConfigured) {
    return null;
  }

  const currentStillAvailable = currentCoverId !== null && choices.photos.some((photo) => photo.id === currentCoverId);

  return (
    <fieldset className="grid gap-3 rounded-xl border border-ink/15 px-4 py-3">
      <legend className="px-1 text-sm font-medium text-ink">課程封面（選填）</legend>
      <p className="text-xs leading-5 text-ink-faint">
        封面會顯示在課程列表與課程頁上。沒放封面也沒關係，頁面會用品牌色塊代替。
        {isSeriesSession ? "這堂課屬於系列，封面是整個系列共用的。" : ""}
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {mode === "edit" ? (
          <label className={optionClass}>
            <input
              className="sr-only"
              defaultChecked
              name="coverChoice"
              type="radio"
              value="keep"
            />
            <span className="grid aspect-[3/2] place-items-center rounded-lg bg-cream px-2 text-center text-xs">
              {currentCoverId === null ? "目前沒有封面" : currentStillAvailable ? "維持目前的封面" : "維持目前的設定"}
            </span>
            <span className="text-center">不變</span>
          </label>
        ) : null}
        <label className={optionClass}>
          <input className="sr-only" defaultChecked={mode === "create"} name="coverChoice" type="radio" value="none" />
          <span className="grid aspect-[3/2] place-items-center rounded-lg bg-cream px-2 text-center text-xs">品牌色塊</span>
          <span className="text-center">不放封面</span>
        </label>
        {choices.photos.map((photo, index) => (
          <label className={optionClass} key={photo.id}>
            <input className="sr-only" name="coverChoice" type="radio" value={photo.id} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt={`第 ${index + 1} 張照片`} className="aspect-[3/2] w-full rounded-lg bg-cream object-cover" src={photo.url} />
            <span className="text-center">第 {index + 1} 張照片</span>
          </label>
        ))}
      </div>
      {choices.canUpload ? (
        <div>
          <label className="text-sm font-medium text-ink" htmlFor={`${idPrefix}coverUpload`}>
            或上傳一張新照片當封面
          </label>
          <input
            accept="image/jpeg,image/png,image/webp"
            className="mt-2 block w-full text-sm text-ink-soft file:mr-3 file:rounded-full file:border file:border-ink/25 file:bg-white file:px-4 file:py-2 file:text-sm file:font-medium file:text-ink"
            id={`${idPrefix}coverUpload`}
            name="coverUpload"
            type="file"
          />
          <p className="mt-1 text-xs leading-5 text-ink-faint">
            有選檔案就以檔案為準；新照片也會放進「老師資料 › 照片」（最多 5 張）。
          </p>
        </div>
      ) : (
        <p className="text-xs leading-5 text-ink-faint">
          照片已經放滿 5 張，要上傳新照片請先到「老師資料 › 照片」刪除一張。
        </p>
      )}
    </fieldset>
  );
}
