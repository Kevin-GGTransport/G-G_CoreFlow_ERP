/**
 * 删除费用：若已被发票明细引用则禁止删除（invoice_line_items.fee_id → Restrict）
 */

import prisma from '@/lib/prisma'

export type DeleteFeeResult =
  | { ok: true }
  | { ok: false; error: string; lineCount: number }

export async function deleteFeeIfUnused(feeId: bigint): Promise<DeleteFeeResult> {
  const lineCount = await prisma.invoice_line_items.count({
    where: { fee_id: feeId },
  })
  if (lineCount > 0) {
    return {
      ok: false,
      error:
        '该费用已被账单明细引用，无法删除。请先在对应直送/拆柜等账单中移除该明细行，或调整引用后再删。',
      lineCount,
    }
  }
  await prisma.fee.delete({ where: { id: feeId } })
  return { ok: true }
}
