import Link from "next/link";
import type { ReactNode } from "react";

// teacher-showcase-photos 票 05（spec 第 5 節）：課程卡片與課程頁的封面。
// 圖片都是裝飾用（alt 為空）：標題、時間、老師名字已經在文字裡，不讓圖片說明重複進連結名稱。
// 文字一律不壓在照片上：標籤是有底色的小晶片，可讀性不受照片明暗影響。

const chipOnPhoto = "rounded-full bg-white/95 px-3 py-1 text-xs font-medium text-ink shadow-sm";

// 列表卡片的封面區：桌面固定 3:2、手機 16:9（節省高度），有封面顯示照片；沒有封面顯示品牌色塊（不寫「尚未提供」），所以每張卡片高度一致。
export function CardCover({
  url,
  tags,
  styleLabel,
}: {
  url: string | null;
  // 左上角的小標籤（來源、持續開課、期班堂數）。
  tags: ReactNode;
  // 瑜伽類型：有封面時是左下角的小標籤，沒封面時是色塊上的文字。
  styleLabel: string | null;
}) {
  return (
    <div className="relative aspect-[16/9] overflow-hidden bg-gradient-to-br from-pine-tint to-cream sm:aspect-[3/2]" data-testid="card-cover">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt="" className="size-full object-cover" loading="lazy" src={url} />
      ) : (
        <div aria-hidden="true" className="grid size-full place-items-center px-6 text-center text-base font-medium tracking-wide text-pine-deep/80">
          {styleLabel ?? "飛索"}
        </div>
      )}
      <div className="absolute left-3 top-3 flex max-w-[calc(100%-1.5rem)] flex-wrap gap-2 [&>span]:bg-white/95 [&>span]:shadow-sm">{tags}</div>
      {url && styleLabel ? <span className={`absolute bottom-3 left-3 max-w-[calc(100%-1.5rem)] truncate ${chipOnPhoto}`}>{styleLabel}</span> : null}
    </div>
  );
}

// 課程頁頂端的封面：有填才顯示（沒有封面就整塊不出現），不放品牌色塊。
export function DetailCover({ url }: { url: string | null }) {
  if (!url) {
    return null;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt="" className="aspect-[16/9] w-full rounded-2xl bg-pine-tint object-cover sm:aspect-[2/1]" src={url} />
  );
}

// 老師小頭像加名字；沒有頭像就只顯示名字（不放灰色圓圈）。
export function TeacherByline({
  name,
  avatarUrl,
  href = null,
}: {
  name: string;
  avatarUrl: string | null;
  // 老師有公開頁時，名字連到老師頁（列表卡片本身是連結，卡片上不放這個）。
  href?: string | null;
}) {
  const content = <span className="min-w-0 truncate">{name}</span>;

  return (
    <span className="flex min-w-0 items-center gap-2">
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt="" className="size-6 shrink-0 rounded-full bg-pine-tint object-cover" loading="lazy" src={avatarUrl} />
      ) : null}
      {href ? (
        <Link className="min-w-0 truncate underline underline-offset-4 hover:text-pine" href={href}>
          {name}
        </Link>
      ) : (
        content
      )}
    </span>
  );
}

// 瑜伽類型標籤文字：第一個，超過一個加「等」。
export function yogaStyleLabel(yogaStyles: string[]): string | null {
  if (yogaStyles.length === 0) {
    return null;
  }

  return yogaStyles.length > 1 ? `${yogaStyles[0]}等` : yogaStyles[0];
}
