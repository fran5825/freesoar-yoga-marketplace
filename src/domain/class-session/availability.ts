// 學員看到的「名額與報名狀態」。規則沿用 create-enrollment-core.ts（Gate G3 = A）：
// pending 與 confirmed 都佔名額，cancelled 不佔。只做顯示用的計算，真正擋報名的仍是
// createEnrollment 在資料庫鎖內的檢查。
export type ClassAvailabilityState = "open" | "full" | "started";

export type ClassAvailability = {
  remainingSeats: number;
  state: ClassAvailabilityState;
};

export function getClassAvailability({
  capacity,
  activeEnrollmentCount,
  startAt,
  now = new Date(),
}: {
  capacity: number;
  activeEnrollmentCount: number;
  startAt: Date;
  now?: Date;
}): ClassAvailability {
  const remainingSeats = Math.max(capacity - activeEnrollmentCount, 0);

  if (startAt.getTime() <= now.getTime()) {
    return { remainingSeats, state: "started" };
  }

  return { remainingSeats, state: remainingSeats === 0 ? "full" : "open" };
}
