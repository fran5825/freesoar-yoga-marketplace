# 老師第一次使用：票券總覽

來源：[spec](../../../specs/teacher-first-run-spec.md)；問題清單見[走查報告](../teacher-experience-walkthrough/2026-10-24-first-time-teacher-walkthrough.md)。建立日期：2026-10-24。

三張 HEAVY 票：

- **02**：改變核心建課流程（預設建立即開放）。不改 schema，在一般工作區做，但要有計畫、rollback 方式與獨立 review。
- **05、06**：只在 Prisma enum 各新增一個值，在獨立 worktree＋獨立測試資料庫做，排隊執行，避免兩份 migration 衝突。

## 票券與相依

| # | 票 | Mode | Human Gate | Blocked by | Status |
|---|----|------|-----------|-----------|--------|
| 01 | 老師開課預設公開，並沿用上一堂的公開設定 | STANDARD | no | – | draft |
| 02 | 單堂課建立後直接開放報名 | HEAVY | yes | 01 | draft |
| 03 | 開放報名前的收款資訊提醒 | STANDARD | no | 02 | draft |
| 04 | 單堂報名與取消時通知老師 | STANDARD | no | – | draft |
| 05 | 整期報名與退出整期時通知老師（新增系列 target） | HEAVY | yes | 04 | draft |
| 06 | 新團體需求通知老師、名稱統一為「團體需求」 | HEAVY | yes | 05 | draft |
| 07 | 老師公開頁開關搬到「個人資料」分頁 | LIGHT | no | – | done |
| 08 | 總覽「開始使用」與通過通知 | STANDARD | no | 07 | done |
| 09 | 審核中畫面的三件事、退回通知改成可修正語氣 | LIGHT | no | 08 | draft |
| 10 | 驗收與文件同步 | STANDARD | no | 01–09 | draft |

```text
01 ──> 02 ──> 03 ─────────────┐
04 ──> 05 ──> 06 ─────────────┼──> 10
07 ──> 08 ──> 09 ─────────────┘
```

三條線可以同時進行：建課（01→02→03）、通知（04→05→06）、總覽與申請（07→08→09）。

## 會改到同一批檔案的地方

- 通知文案與連結：04、05、06、08、09 都會改，同一條線內已排隊；跨線（04 與 08）改的是不同通知類型，合併時留意。
- 建課表單：01、02、03 依序排隊。

## 進度紀錄

（每張票完成時補一行）

<!-- codex-peer-reviewed: 2026-10-24T08:10:27Z rounds=2 verdict=approved -->
