# 09: 期班頁每一堂可單堂報名、備註收起

來源：[spec Q1、Q5、2.1、2.2](../../../../specs/member-inline-enroll-spec.md)。

**What to build:** 期班頁「查看每一堂」中可單堂報名的列，用票 06 的共用列就地報名；帶 `focus` 或 `open` 回來時，自動展開這個收合區再捲到那一列。重新報名表單的備註改用「加備註」。

**Blocked by:** 06

**Status:** 待開始

**Workflow mode:** STANDARD

**Human Gate:** no

**Risk flags:** 無。

- [ ] 期班頁每一堂列用共用列（只有 `term_and_single` 的期班才有單堂報名；只收整期維持現狀）
- [ ] `canEnrollSingle` 擴成 spec 2.1 的完整列狀態
- [ ] 期班頁既有的回饋位置在整期報名卡內：單堂列的結果改用 06 的共用回饋，顯示在頁面頂部與該列上方；整期報名的回饋維持原位
- [ ] 收合區自動展開與捲動
- [ ] 重新報名表單（`ClassOwnEnrollment`）備註改 `OptionalNotes`
- [ ] 測試：單堂報名、重新報名、整期列的請假、只收整期不出現單堂報名、收合區自動展開、手機 375px 無橫向溢出

<!-- codex-peer-reviewed: 2026-10-10T04:28:50Z rounds=2 verdict=approved -->
