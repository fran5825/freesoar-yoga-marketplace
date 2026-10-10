import path from "node:path";

// teacher-showcase-photos：端對端測試用本機資料夾當照片倉庫（STORAGE_DRIVER=local）。
// playwright.config.ts 啟動伺服器時帶同一個資料夾，測試程式也用這個路徑直接讀寫，兩邊看到同一批檔案。
// 放在 .ai-runs（已被 Git 忽略）底下，不會留在專案裡。
export const E2E_LOCAL_STORAGE_DIR = path.join(process.cwd(), ".ai-runs", "e2e-photo-storage");
