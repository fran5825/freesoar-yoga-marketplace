import { SIGN_IN_PROVIDERS } from "@/lib/auth/sign-in-providers";

// member-flow-redesign 票 05：課程頁報名區與 /sign-in 共用的登入按鈕。依「目前開放的登入方式」
// 清單畫出，每顆按鈕是一個表單，送出 provider 與呼叫端給的隱藏欄位（例如這次要回去的頁面）。
// 之後加 LINE、Facebook 等登入方式，只要加進 src/lib/auth/sign-in-providers.ts，兩頁同時更新。
export function SignInOptions({
  action,
  fields,
  label,
  buttonClassName,
}: {
  action: (formData: FormData) => Promise<void>;
  fields: Record<string, string>;
  label: (providerLabel: string) => string;
  buttonClassName: string;
}) {
  return (
    <div className="grid gap-3">
      {SIGN_IN_PROVIDERS.map((provider) => (
        <form action={action} key={provider.id}>
          <input name="provider" type="hidden" value={provider.id} />
          {Object.entries(fields).map(([name, value]) => (
            <input key={name} name={name} type="hidden" value={value} />
          ))}
          <button className={buttonClassName} type="submit">
            {label(provider.label)}
          </button>
        </form>
      ))}
    </div>
  );
}
