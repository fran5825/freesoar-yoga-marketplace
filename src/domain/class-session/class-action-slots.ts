// teacher-series-rollup 票 01（spec 2.2）：單堂頁與系列頁的「快速按鈕」規則。
// 每個狀態最多兩顆常駐按鈕：第一顆依狀態、第二顆是那個狀態最常用的；其他可用動作放進「其餘」（攤開或收進「更多」）。
// 只決定「哪些動作放哪裡」，不決定能不能做：呼叫端傳入這個角色此刻真正可用的動作（沿用各頁既有條件與 action），
// 角色沒有的動作一律不會出現。
//
// 老師／團主：草稿＝開放報名＋修改課程；開放中且未開始＝複製報名連結＋取消課程（不可逆的放第二顆）；
// 已結束待完成＝標記完成。管理員只有取消課程，可取消時它是唯一一顆。

export type ClassActionKey = "open" | "edit" | "copyLink" | "cancel" | "complete" | "cancelFromHere";

export type ClassActionPhase = "draft" | "open_before_start" | "in_progress" | "ended_awaiting_completion" | "closed";

export type ClassActionSlots = {
  primary: ClassActionKey | null;
  secondary: ClassActionKey | null;
  rest: ClassActionKey[];
};

const preferred: Record<ClassActionPhase, [ClassActionKey | null, ClassActionKey | null]> = {
  draft: ["open", "edit"],
  open_before_start: ["copyLink", "cancel"],
  in_progress: [null, null],
  ended_awaiting_completion: ["complete", null],
  closed: [null, null],
};

const restOrder: ClassActionKey[] = ["edit", "copyLink", "open", "complete", "cancel", "cancelFromHere"];

export function classActionPhase(input: { status: string; startAt: Date; endAt: Date; now?: Date }): ClassActionPhase {
  const now = (input.now ?? new Date()).getTime();

  if (input.status === "draft") {
    return "draft";
  }

  if (input.status === "open_for_enrollment" || input.status === "confirmed") {
    if (input.endAt.getTime() <= now) return "ended_awaiting_completion";
    if (input.startAt.getTime() <= now) return "in_progress";
    return "open_before_start";
  }

  return "closed";
}

export function getClassActionSlots(input: {
  phase: ClassActionPhase;
  available: ClassActionKey[];
  // 管理員：只露第一顆，不放第二顆（spec 2.2 角色別按鈕）。
  singleSlot?: boolean;
}): ClassActionSlots {
  const available = new Set(input.available);
  const [first, second] = preferred[input.phase];
  let primary = first && available.has(first) ? first : null;
  let secondary = !input.singleSlot && second && available.has(second) ? second : null;

  // 第一顆不可用時，第二顆往前補（例如團主媒合的課，老師只能複製連結）。
  if (!primary && secondary) {
    primary = secondary;
    secondary = null;
  }

  // 只有取消可用時（例如管理員），它就是唯一一顆。
  if (!primary && input.singleSlot && available.has("cancel")) {
    primary = "cancel";
  }

  const used = new Set([primary, secondary]);

  return {
    primary,
    secondary,
    rest: restOrder.filter((key) => available.has(key) && !used.has(key)),
  };
}
