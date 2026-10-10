// 學員看到的報名狀態標籤。文案與樣式只在這裡定義，dashboard、我的報名、課程詳情共用。
export const enrollmentStatusLabels: Record<string, string> = {
  pending: "等待老師確認",
  confirmed: "已報名",
  cancelled: "已取消",
  attended: "已出席",
  no_show: "未出席",
};

export function EnrollmentStatusBadge({ status }: { status: string }) {
  return (
    <span className="w-fit rounded-full bg-pine-tint px-3 py-1 text-xs font-medium text-pine">
      {enrollmentStatusLabels[status] ?? status}
    </span>
  );
}
