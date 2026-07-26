import type { Prisma } from "@prisma/client";

// D4：select 成功時，同一 transaction 內把 DemandRequest 從 published 轉為 matched。
// 供 demand-response domain 的 select service 在自己的 tx 內呼叫，不自行開啟 transaction。
export class DemandRequestNotMatchableError extends Error {
  constructor(public readonly demandRequestId: string) {
    super("Demand request is not in a matchable (published) state");
    this.name = "DemandRequestNotMatchableError";
  }
}

// count===0（demand 已經是 matched，或非 published 的其他狀態）一律 throw，
// 讓呼叫方所在的 prisma.$transaction callback 因例外而 rollback，不能被靜默轉成回傳值
// （否則前面已在同一個 tx 內完成的 select/decline 寫入會被誤 commit）。
export async function markDemandRequestAsMatchedIfPublished(
  tx: Prisma.TransactionClient,
  demandRequestId: string,
): Promise<void> {
  const result = await tx.demandRequest.updateMany({
    where: { id: demandRequestId, status: "published" },
    data: { status: "matched" },
  });

  if (result.count === 0) {
    throw new DemandRequestNotMatchableError(demandRequestId);
  }
}
