# 04: 選團體、存需求草稿、補資料返回

**What to build:** 團主選自己的團體填一頁需求，明確存草稿；缺聯絡資料時儲存後前往補資料，再回到同一筆繼續送審。

**Blocked by:** 03：我的團體與首次建團

**Status:** draft

**Workflow mode:** HEAVY

**Human Gate:** yes（需產品主人確認；Q1–Q19 產品／模型方案與本次切票已核准。依既定範圍執行不重問同項批准；新增決策、未涵蓋的 migration 細節或不可逆操作仍須 Human Gate。）

**Risk flags:** PERMISSION_RISK、AUTH_RISK、STATE_MACHINE_RISK、LOW_PRESSURE_UX_RISK

- [ ] 需求表單分區、必填／選填、團體摘要與缺項定位一致；新需求明確選 own organization，已有聯絡資料可重用。
- [ ] own draft 可換團體；已送出需求維持原歸屬，不能直接換團體；server guard 不信任 client。
- [ ] 首次儲存後使用含 demand ID 的穩定編輯 URL，更新、refresh、補資料返回都用同筆，不額外新建。
- [ ] 儲存並補資料在保存成功後才離開；儲存失敗保留輸入與錯誤，不跳頁；合法站內返回不得開放任意 URL redirect。
- [ ] 未保存修改有 internal navigation 與 unload 保護；明確保存與送審是不同動作，不新增持續雲端 autosave。
- [ ] 驗證失敗保留原欄位；重送仍檢查團體完整度與既有需求狀態；送審成功前往單筆詳情，顯示下一位處理者。
- [ ] 測試兩團體選擇、非 own ID、已送出不可換、補資料／登入返回同 ID、失敗不丟內容與手機操作；更新受影響文件。

