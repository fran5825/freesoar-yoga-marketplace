# 06: 老師確認／婉拒與共用排課保護

**What to build:** 受邀老師能確認或附原因婉拒；確認成功才保留時段，所有既有建課方式都能防止與此安排衝突。

**Blocked by:** 05：建立合作邀請並送給老師

**Status:** draft

**Workflow mode:** HEAVY

**Human Gate:** yes（需產品主人確認；Q1–Q19 產品／模型方案與本次切票已核准。依既定範圍執行不重問同項批准；新增決策、未涵蓋的 migration 細節或不可逆操作仍須 Human Gate。）

**Risk flags:** PERMISSION_RISK、STATE_MACHINE_RISK、LARGE_REFACTOR_RISK

- [ ] 老師只能處理自己的 pending 邀請；confirm 驗 latest version、approved、future、課程完整性；decline 要有有界原因，結果雙端可見。
- [ ] 共用 TeacherProfile lock 與 conflict 判斷，同時涵蓋非 cancelled 課程（包含 draft）與 confirmed／未轉課 proposal；pending／declined 不占時段。
- [ ] 既有 organizer_matched、teacher_initiated、老師 recurring 的建立路徑採相容擴充，不繞過 confirmed 預留，保留既有介面與 test hooks。
- [ ] 確認寫入 accepted version／actor／time；舊頁面不能接受新版，老師資格或時間變動會得到可理解的錯誤。
- [ ] 同老師重疊的並發確認只有一筆成功；確認與既有建課競態不能 double-book；統一鎖順序並在鎖內重驗 teacher ID／version。
- [ ] 老師確認不授予團主的開放、取消、完成或名單管理能力；未確認、婉拒與衝突各有明確下一步。
- [ ] 驗證角色／version／資格／過期、跨來源及 recurring 衝突、並發與不重複確認；更新 state／permission／排課文件。

