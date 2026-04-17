/**
 * 发票「已审核」与应收模块联动：推送、退回、以及明细变更后的状态降级。
 */

import { Prisma, PrismaClient } from '@prisma/client'

type DbClient = PrismaClient | Prisma.TransactionClient

export class ReceivableWithdrawError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ReceivableWithdrawError'
  }
}

/** 若该发票对应应收已有核销金额，返回不可退回的原因文案；否则返回 null。 */
export async function getReceivableWithdrawBlockReason(
  db: DbClient,
  invoiceId: bigint
): Promise<string | null> {
  const rec = await db.receivables.findFirst({
    where: { invoice_id: invoiceId },
    select: { allocated_amount: true },
  })
  if (!rec) return null
  if (Number(rec.allocated_amount ?? 0) > 0) {
    return '该账单在应收已有收款分配，无法完成此操作。请先处理收款核销后再试。'
  }
  return null
}

/** 状态为已审核时，将发票金额同步到应收（单票一条应收，按 invoice_id 关联）。 */
export async function upsertReceivableForAuditedInvoice(
  db: DbClient,
  invoiceId: bigint,
  userId: bigint | null
): Promise<void> {
  const inv = await db.invoices.findUnique({
    where: { invoice_id: invoiceId },
    select: {
      customer_id: true,
      total_amount: true,
      invoice_date: true,
      status: true,
    },
  })
  if (!inv || inv.status !== 'audited') return

  const existing = await db.receivables.findFirst({
    where: { invoice_id: invoiceId },
    select: {
      receivable_id: true,
      allocated_amount: true,
    },
  })

  const receivableAmount = inv.total_amount
  const allocated = existing?.allocated_amount ?? new Prisma.Decimal(0)
  const totalDec = new Prisma.Decimal(receivableAmount.toString())
  const balance = totalDec.sub(allocated)

  const common = {
    customer_id: inv.customer_id,
    receivable_amount: receivableAmount,
    allocated_amount: allocated,
    balance,
    due_date: inv.invoice_date,
    status: balance.lte(0) ? 'closed' : 'open',
    updated_by: userId,
    updated_at: new Date(),
  }

  if (existing) {
    await db.receivables.update({
      where: { receivable_id: existing.receivable_id },
      data: common,
    })
  } else {
    await db.receivables.create({
      data: {
        invoice_id: invoiceId,
        ...common,
        created_by: userId,
      },
    })
  }
}

/** 从应收中移除该票（无核销金额时删除记录）。若已有核销则抛出 ReceivableWithdrawError。 */
export async function withdrawReceivableForInvoice(
  db: DbClient,
  invoiceId: bigint
): Promise<void> {
  const rec = await db.receivables.findFirst({
    where: { invoice_id: invoiceId },
    select: { receivable_id: true, allocated_amount: true },
  })
  if (!rec) return
  if (Number(rec.allocated_amount ?? 0) > 0) {
    throw new ReceivableWithdrawError(
      '该账单在应收已有收款分配，无法自动从应收退回。请先处理收款核销后再变更状态。'
    )
  }
  await db.receivables.delete({
    where: { receivable_id: rec.receivable_id },
  })
}

/**
 * 已审核状态下若修改了明细：删除应收并将发票降为「已开票」。
 * 调用方应在事务内执行；若当前非已审核则 noop。
 */
export async function downgradeAuditedInvoiceAfterLineMutation(
  tx: Prisma.TransactionClient,
  invoiceId: bigint,
  userId: bigint | null
): Promise<void> {
  const inv = await tx.invoices.findUnique({
    where: { invoice_id: invoiceId },
    select: { status: true },
  })
  if (inv?.status !== 'audited') return

  await withdrawReceivableForInvoice(tx, invoiceId)

  await tx.invoices.update({
    where: { invoice_id: invoiceId },
    data: {
      status: 'issued',
      updated_by: userId,
      updated_at: new Date(),
    },
  })
}
