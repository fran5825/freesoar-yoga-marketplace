# 07: 修改、撤回與重新邀請

**What to build:** 團主能調整、撤回或在老師婉拒後重送邀請；老師先前的確認不會被套用到已修改的課程內容。

**Blocked by:** 06：老師確認／婉拒與共用排課保護

**Status:** draft

**Workflow mode:** HEAVY

**Human Gate:** yes（需產品主人確認；Q1–Q19 產品／模型方案與本次切票已核准。依既定範圍執行不重問同項批准；新增決策、未涵蓋的 migration 細節或不可逆操作仍須 Human Gate。）

**Risk flags:** PERMISSION_RISK、STATE_MACHINE_RISK

- [ ] 團主 own-scoped 處理尚未轉課邀請；pending 修改增加 version，舊老師頁面確認被拒；declined 顯示原因與修改重送入口。
- [ ] confirmed 課程內容異動回 draft，清除 accepted metadata／釋放預留，必須重新送出並確認；不保留舊版本的授課同意。
- [ ] 撤回依核准 transition 執行，pending 不釋放不存在的資源、confirmed 正確釋放；withdrawn 不可偷偷復活。
- [ ] 換老師或異動需要不同 TeacherProfile lock 時依固定排序，再重驗狀態／teacher／version；與確認、轉課的競態不丟失或重複預留。
- [ ] 已送出邀請不能直接換團體；需撤回／新建。converted／已開放不可修改內容，只能沿用既有取消再建流程。
- [ ] 儲存失敗保留輸入；兩端詳情顯示最新版、拒絕／撤回理由、下一個 actor，不顯示舊確認可開放。
- [ ] 驗證 stale version、confirm/edit/withdraw 競態、釋放後可再排課、他人 ID、轉課後不可改，以及 declined 修改重送；更新狀態文件。

