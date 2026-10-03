# 04：我的課程：分類、開課入口與返回位置

**What to build:** 老師從我的課程找到近期、草稿或過往課程，進詳情處理報名後，能回到原來源、篩選與位置；建立課程入口在頁面頂端。

**Blocked by:** 03 單堂詳情：資訊與報名操作順手（在已完成的詳情與操作回饋路徑接入返回上下文）。

**Status:** draft

**Workflow mode:** STANDARD

**Human Gate:** yes

**Risk flags:** BRAND_RISK、LOW_PRESSURE_UX_RISK、SCOPE_DRIFT_RISK。

## 驗收條件

- [ ] 預設「即將上課」，另有草稿、過往、全部入口；全部含取消且可篩選取消狀態，空結果可辨識與切換。
- [ ] 即將上課為 endAt > now 且排除 draft／cancelled／completed，含進行中，由近到遠；草稿按狀態保留，不因日期過去消失。
- [ ] 過往排除草稿與取消，包含 endAt <= now 或 completed，由新到舊；分類只是 UI 投影，不新增狀態或放寬操作時間。
- [ ] 建立課程放標題旁（電腦）或下方（手機），依既有 profile 資格顯示，不搬至全站導覽、不擴建課資格。
- [ ] 系列仍逐堂按日期排列，卡片提供清楚單堂與系列入口；不巢狀連結、不合併成只看得到系列的單張卡。
- [ ] 從列表／系列進詳情再返回，保留來源、篩選及位置；直接進詳情時有預設我的課程退路，詳情 mutation 後仍在同堂且保留上下文。
- [ ] 返回僅接受本地老師列表／本人系列與白名單參數；拒絕外部 URL、雙斜線、其他角色 route、未知參數及非本人系列，不造成 open redirect 或跨老師資訊曝光。
- [ ] outcome tests 覆蓋時間邊界、取消分類、列表及系列返回、直連退路、mutation 後返回及惡意來源；三種寬度、鍵盤與長卡片可使用。

## 實作與驗證邊界

- 可新增狹窄的返回上下文 adapter；business actions 的權限、寫入與通知 policy 不變，不使用任意 callback URL 當完整白名單。
- 現有系列頁只接入返回來源，場次內容及取消改版留 05；暫停者導覽入口留 07。
- 不依賴 01／02 的新表單；現有建課入口即可驗收。
- 執行 diff whitespace、TypeScript、ESLint、build、列表／返回 helper 邊界與詳情 mutation smoke，完成 RWD QA。
- rollback 僅回復分類與導覽 adapter，不改課程狀態或資料。
- 實作需本票範圍核准；需要權限政策變動時停止，另提 HEAVY decision plan。
