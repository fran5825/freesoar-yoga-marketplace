import { expect, type Locator } from "@playwright/test";

// 頁面先顯示伺服器送來的 HTML，之後 React 才接上互動（hydration）。機器忙的時候這段會晚幾秒；
// 在那之前點擊會沒作用，`fill` 的全選也可能沒生效，造成新舊文字接在一起（2026-10-09 已重現）。
// React 接上元素後，DOM 節點會多一個 `__reactProps$…` 屬性；等到它出現再操作。
export async function waitForHydrated(locator: Locator): Promise<void> {
  await expect
    .poll(
      () => locator.evaluate((element) => Object.keys(element).some((key) => key.startsWith("__reactProps"))),
      { message: "waiting for React to hydrate the element" },
    )
    .toBe(true);
}
