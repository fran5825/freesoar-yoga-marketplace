// teacher-class-scheduling 票 10：期班追加補課時，這一期剩下（尚未開始、未取消）的場次都已開放報名，
// 補課就直接建立成開放報名；否則先存成草稿。補課核心與系列頁（teacher-first-run 票 03 的收款提醒）共用這條規則。
export function makeupOpensForEnrollment(
  remaining: { status: string }[],
): boolean {
  return remaining.every((session) => session.status === "open_for_enrollment");
}

// 系列頁用：從整期的場次挑出「剩下的」再套用上面的規則，條件與補課核心的查詢一致。
export function makeupOpensForEnrollmentFromOccurrences(
  occurrences: { status: string; startAt: Date }[],
  now: number,
): boolean {
  return makeupOpensForEnrollment(
    occurrences.filter((occurrence) => occurrence.status !== "cancelled" && occurrence.startAt.getTime() > now),
  );
}
