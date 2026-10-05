import type { OrganizerClassProposalStatus } from "@prisma/client";

// organizer-usability-redesign 票 12（spec 13.7）：一次成功寫入合作邀請後，交給通知的資料。
// 在同一個 transaction 內取得，所以 transitionSeq 一定是這次寫入的值（重試同一次轉換時相同），
// before／after 讓通知依修改前後兩組資料決定收件人（例如換老師時通知原老師）。
// title 也在交易內取得：換老師時原老師的「已取消」通知用修改前的課名，不會看到新草稿的內容。
export type ProposalSnapshot = {
  status: OrganizerClassProposalStatus;
  teacherProfileId: string | null;
  title: string | null;
};

export type ProposalTransitionEvent = {
  proposalId: string;
  transitionSeq: number;
  before: ProposalSnapshot;
  after: ProposalSnapshot;
};
