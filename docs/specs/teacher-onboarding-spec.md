# Teacher Onboarding Spec

## 目的

Teacher onboarding 讓瑜伽老師可以加入 Free Soar Yoga，建立可信任的 teacher profile，並經由 Admin approval 後進入 marketplace。

V1 的重點是品質、信任與清楚流程，不是讓老師建立完整 SaaS 型個人商店。

## User Role

主要角色：

- Visitor
- Teacher
- Admin

## Problem

Free Soar Yoga 需要確保進入 demand pool 的老師具備基本可信任資訊，並符合品牌精神與團課服務期待。

若沒有審核流程，團主與會員的信任感會下降；若流程太複雜，老師加入意願會下降。

## User Flow

1. Visitor 進入 `/teachers/join`。
2. Visitor 了解 Free Soar Yoga 對老師的定位與合作方式。
3. Visitor 註冊或登入。
4. Teacher 填寫 teacher application form。
5. Teacher 儲存 draft 或 submit application。
6. 系統建立或更新 `TeacherProfile`。
7. Admin 在 `/admin/teachers` review submitted profile。
8. Admin approve 或 reject。
9. Approved Teacher 可進入 teacher dashboard、設定 availability、查看 eligible demand requests。

## UI Requirements

- `Teacher Join` 頁面語氣要尊重老師，不把老師商品化。
- 表單需 mobile-first，欄位分段清楚。
- Teacher dashboard 需顯示 profile status 與下一步。
- Submitted 後需清楚告知「正在審核」。
- Rejected 需顯示溫和且具體的補件或修正方向。

## Data Requirements

主要資料：

- `User`
- `TeacherProfile`
- `TeacherAvailability`
- `AvailabilityException`
- `AdminNote`
- `Notification`

`TeacherProfile` 必要欄位：

- `userId`
- `displayName`
- `bio`
- `teachingStyle`
- `experienceYears`
- `specialties`
- `serviceAreas`
- `teachingFormats`
- `status`

## Permission Requirements

- Visitor 可看 teacher join page。
- Teacher 只能建立與編輯自己的 profile。
- Teacher 不可 approve 自己。
- Teacher 未 approved 前不可回應 demand request。
- Admin 可 review、approve、reject、suspend teacher profile。

## State Transitions

`TeacherProfile`：

```text
draft → submitted → approved
                   → rejected
approved → suspended
rejected → submitted
```

`rejected → submitted` 代表老師可在允許情況下修改後重新送審。

## RWD Requirements

- 360px 與 390px 手機寬度可完成表單。
- 長表單需分段，避免一次顯示過多資訊。
- 上傳或照片欄位如 V1 實作，手機上需有清楚 fallback。
- Admin review 至少在 tablet / desktop 可用。

## Acceptance Criteria

- Teacher 可以建立 draft profile。
- Teacher 可以 submit application。
- Submitted profile 會出現在 Admin review list。
- Admin 可以 approve teacher。
- Admin 可以 reject teacher 並留下 reason。
- Approved teacher 可以進入 demand pool。
- 未 approved teacher 不可回應 demand request。
- Suspended teacher 不可公開顯示或回應新需求。

## Non-goals

- 老師個人網站產生器
- 老師課程銷售頁
- 複雜收益報表
- 完整 teacher SaaS tools
- AI 自動審核老師
- 付費方案與抽成邏輯

## Risks

- 表單過長會降低老師完成率。
- 審核標準不清會造成 Admin 判斷不一致。
- 未 approved teacher 若可回應需求，會破壞 marketplace 信任。
- 老師 profile 若太像低價商品頁，會偏離 Free Soar 品牌。
