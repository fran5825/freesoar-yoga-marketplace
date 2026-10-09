# 05: 驗收與文件同步

來源：[spec](../../../../specs/enrollment-re-enrollment-spec.md)。

**What to build:** 確認整條流程可用並把文件改成與實際行為一致：單堂取消後重新報名、整期請假後取消請假（兩種模式）、不能重新報名的各種情況，桌面與手機都跑一次。

**Blocked by:** 02、03、04

**Status:** draft

**Workflow mode:** STANDARD

**Human Gate:** no

**Risk flags:** 無。

- [ ] Playwright：學員從取消到重新報名／取消請假的完整流程（桌面與手機），含不能重新報名的原因文案
- [ ] 更新 `docs/domain/state-machines.md`、`docs/domain/state-transition-details.md`（取代 D8，改寫「取消後不可重新報名」）、`docs/domain/data-model.md`、`docs/domain/permissions-matrix.md`（學員可對自己取消的報名重新報名）
- [ ] 更新 `docs/context/glossary.md` 與 `docs/product/route-map.md`（若頁面說明有變）
- [ ] 全部受影響 spec 通過；TypeScript、ESLint、build 通過

<!-- codex-peer-reviewed: 2026-10-09T16:22:17Z rounds=3 verdict=approved -->
