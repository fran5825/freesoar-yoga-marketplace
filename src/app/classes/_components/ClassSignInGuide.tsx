import Link from "next/link";

import { SignInOptions } from "../../_components/sign-in-options";
import { signInToEnrollAction } from "../[classSessionId]/actions";

const buttonClass = "inline-flex min-h-11 w-full items-center justify-center rounded-full bg-pine px-5 py-3 text-center text-sm font-medium text-white hover:bg-pine-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay sm:w-fit";

// organizer-usability-redesign 票 13（spec 3.4、13.8）：訪客打開公開規則讀不到的課程網址
// （不存在、草稿、僅透過連結招募、已取消、老師不是 approved）時，一律顯示這個通用登入引導。
// 內容只依網址上的 id 與找課條件產生，不讀任何課程資料，所以不同情況的回應完全相同，
// 不透露課程是否存在、標題、老師或地點。登入後回到同一個網址，再依既有 Member 規則讀取。
export function ClassSignInGuide({ classSessionId, returnTo }: { classSessionId: string; returnTo: string }) {
  return (
    <div className="grid min-w-0 gap-6">
      <Link className="w-fit py-2 text-sm text-clay underline" href={returnTo}>返回課程列表</Link>
      <section aria-labelledby="class-sign-in-heading" className="grid gap-4 rounded-2xl border border-pine/25 bg-white p-5 sm:p-6">
        <h1 className="text-2xl font-semibold tracking-tight text-ink" id="class-sign-in-heading">登入後查看這堂課</h1>
        <p className="text-sm leading-6 text-ink-soft">
          如果你是收到團主或老師分享的課程連結，登入後就能看到課程時間、地點與名額，並決定是否報名。第一次使用會自動建立帳號；登入後會回到這個連結，報名要由你確認後才會送出。
        </p>
        <SignInOptions
          action={signInToEnrollAction}
          buttonClassName={buttonClass}
          fields={{ classSessionId, returnTo }}
          label={(provider) => `使用 ${provider} 登入查看`}
        />
        <p className="text-xs leading-5 text-ink-faint">
          登入後如果仍然看不到，代表這堂課目前沒有開放，或連結已經失效。
        </p>
      </section>
    </div>
  );
}
