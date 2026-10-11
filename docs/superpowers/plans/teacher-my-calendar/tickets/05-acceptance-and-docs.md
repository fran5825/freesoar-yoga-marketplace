# 05: 驗收與文件同步

來源：[spec 5](../../../../specs/teacher-my-calendar-spec.md)。

**What to build:** 用老師的完整操作走一遍我的行事曆，確認電腦版與手機版都正常，並把相關文件更新到最新。

**Blocked by:** 02、03、04

**Status:** draft

**Workflow mode:** STANDARD

**Human Gate:** no

**Risk flags:** 無

- [ ] E2E 旅程：清單切到月曆→換月→手機點日期看明細（課、草稿、已取消、可授課時間、兩種邀請）→點課再返回
- [ ] 375px 與電腦版截圖驗收，無橫向溢出，點擊目標至少 44px
- [ ] 文件：`docs/product/route-map.md`（`/teacher/classes` 的月曆參數）、`docs/visual-acceptance-checklist.md`、glossary（介面文字有調整時）
- [ ] TypeScript、ESLint、build、相關單元測試通過
