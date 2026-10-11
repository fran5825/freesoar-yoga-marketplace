# 05: 驗收與文件同步

來源：[spec 5](../../../../specs/teacher-my-calendar-spec.md)。

**What to build:** 用老師的完整操作走一遍我的行事曆，確認電腦版與手機版都正常，並把相關文件更新到最新。

**Blocked by:** 02、03、04

**Status:** done

**Workflow mode:** STANDARD

**Human Gate:** no

**Risk flags:** 無

- [x] E2E 旅程：清單切到月曆→換月→手機點日期看明細（課、草稿、已取消、可授課時間、兩種邀請）→點課再返回
- [x] 375px 與電腦版截圖驗收，無橫向溢出，點擊目標至少 44px
- [x] 文件：`docs/product/route-map.md`（`/teacher/classes` 的月曆參數）已更新；glossary 介面文字沒有調整，不需改；`docs/visual-acceptance-checklist.md` 是其他工作階段未 commit 的檔案，畫面驗收項目改列在下方
- [x] TypeScript、ESLint、build、相關單元測試通過

## 產品主人畫面驗收（我的行事曆）

用已通過審核的老師登入，到 `/teacher/classes`：

| # | 做什麼 | 應該看到 |
|---|---|---|
| G1 | 點「月曆」 | 這個月的月曆，從星期日開始；有課的日子電腦版寫課名＋人數（例如 6/10），手機版是色點 |
| G2 | 看已取消、草稿的課 | 已取消是淡色加刪除線；草稿是淡色虛線框 |
| G3 | 看你在「可授課時間」設定過的星期幾 | 那幾天格子是淡色底；點進那天，下方寫「你設定的可授課時間」與時段 |
| G4 | 有團主寄合作邀請給你時 | 待回覆的標「待你確認」；你已確認但團主還沒開課的標「已確認，等團主開課」 |
| G5 | 從月曆點一堂課 → 做一個操作或修改課程 → 按「← 回我的課程」 | 回到同一個月、同一天 |
| G6 | 換到上個月、下個月，再按「回到本月」 | 月份正確切換，回到這個月 |

自動化截圖：`.ai-runs/teacher-calendar-chromium-desktop.png`、`.ai-runs/teacher-calendar-chromium-mobile.png`（2026-10-11）。
