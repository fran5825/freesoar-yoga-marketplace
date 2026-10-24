# 07: 老師公開頁開關搬到「個人資料」分頁

來源：[spec](../../../../specs/teacher-first-run-spec.md)。

**What to build:** 「公開我的老師頁」開關從「照片」分頁搬到「個人資料」分頁，預設值與既有設定不變；「照片」分頁留一行說明連到新位置。

**Blocked by:** None (can start immediately)

**Status:** done

**Workflow mode:** LIGHT

**Human Gate:** no

**Risk flags:** 無

- [x] 個人資料分頁有公開頁開關，可正常開關
- [x] 照片分頁不再有開關，只有一行連到個人資料分頁的說明
- [x] 既有老師的公開設定不變
- [x] 相關 smoke 測試通過（teacher-photo-management、teacher-profile-tabs）

## 進度紀錄

- 2026-10-24：開關搬到個人資料分頁（`#public-page`），照片分頁留一行連結；smoke teacher-photo-management 14、teacher-profile-tabs 2、teacher-public-page 20、showcase-journey-acceptance 2 全數通過。
