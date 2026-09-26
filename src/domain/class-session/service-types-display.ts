// 課程風格（serviceTypes，可多選）的讀取輔助。舊資料與團主媒合的課只有單一 serviceType，
// 所以沒有 serviceTypes 時退回單一值，畫面一律用這個函式，不要各自判斷。
export function getClassServiceTypes(row: {
  serviceType: string | null;
  serviceTypes: string[];
}): string[] {
  if (row.serviceTypes.length > 0) {
    return row.serviceTypes;
  }

  return row.serviceType ? [row.serviceType] : [];
}
