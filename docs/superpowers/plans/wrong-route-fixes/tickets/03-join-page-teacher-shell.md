# 03: 老師申請頁一律用老師專區導覽列（F12）

來源：[spec](../../../../specs/wrong-route-fixes-spec.md)「申請頁導覽列」。

**What to build:** 已登入、還沒有老師資料的人打開老師申請頁，上方是「老師專區」，導覽列只有總覽、老師資料、通知。

**Blocked by:** None (can start immediately)

**Status:** done

**Workflow mode:** LIGHT

**Human Gate:** no

**Risk flags:** 無

- [x] 沒有老師資料的已登入帳號：老師專區＋精簡導覽列
- [x] 草稿、審核中、被退回：維持老師專區（不變）
- [x] 訪客、已通過或暫停的老師：行為不變
- [x] smoke 涵蓋沒有老師資料的情況

## 進度紀錄

- 2026-10-25：`src/app/teachers/join/page.tsx` 已登入一律 `signedInArea="teacher"`；`signed-in-navigation.spec.ts` 改成沒有老師資料的學員看到老師專區、導覽列只有總覽／老師資料／通知。tsc、lint、build、相關 smoke 通過。

<!-- codex-peer-reviewed: 2026-10-25T01:42:34Z rounds=2 verdict=approved -->
