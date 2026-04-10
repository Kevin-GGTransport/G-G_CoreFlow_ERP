/**
 * 将「归属范围 = 所有客户」且未绑定 customer_id 的费用模板，
 * 按客户复制为「指定客户」+ customer_id。
 *
 * - 若该客户已有「cloned_from_fee_id = 模板 id」→ 跳过。
 * - 否则若有无 cloned_from 的旧副本（同 fee_code + 柜型）→ UPDATE 打上 cloned_from，避免再 INSERT。
 * - 否则 INSERT。
 * - 最后删除「多余旧行」：同客户、同编码+柜型已存在带 cloned_from 的副本时，删掉仍无 cloned_from 的重复行（清理历史 72+130 叠在一起的情况）。
 */

import type { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'

function normCt(ct: string | null | undefined): string {
  if (ct == null) return ''
  return String(ct).trim()
}

function cloneKey(customerId: bigint, templateFeeId: bigint): string {
  return `${customerId.toString()}\x1f${templateFeeId.toString()}`
}

function legacyQueueKey(customerId: bigint, feeCode: string, ct: string | null | undefined): string {
  return `${customerId.toString()}\x1f${feeCode}\x1f${normCt(ct)}`
}

export type CloneDefaultFeesResult = {
  created: number
  skipped: number
  linked: number
  removedOrphans: number
  templateCount: number
  customerCount: number
  wouldCreate: number
}

export async function cloneDefaultFeesToCustomers(userId: bigint): Promise<CloneDefaultFeesResult> {
  const templates = await prisma.fee.findMany({
    where: { scope_type: 'all', customer_id: null },
    orderBy: [{ sort_order: 'asc' }, { container_type: 'asc' }, { fee_code: 'asc' }, { id: 'asc' }],
  })

  const customers = await prisma.customers.findMany({
    select: { id: true },
    orderBy: { id: 'asc' },
  })

  if (templates.length === 0 || customers.length === 0) {
    return {
      created: 0,
      skipped: 0,
      linked: 0,
      removedOrphans: 0,
      templateCount: templates.length,
      customerCount: customers.length,
      wouldCreate: 0,
    }
  }

  const templateIds = templates.map((t) => t.id)
  const templateIdSet = new Set(templateIds)
  const customerIds = customers.map((c) => c.id)

  const customerScopedFees = await prisma.fee.findMany({
    where: { customer_id: { in: customerIds } },
    select: {
      id: true,
      customer_id: true,
      fee_code: true,
      container_type: true,
      cloned_from_fee_id: true,
    },
    orderBy: { id: 'asc' },
  })

  const existing = new Set<string>()
  const legacyQueues = new Map<string, bigint[]>()

  for (const row of customerScopedFees) {
    if (row.customer_id == null) continue

    if (row.cloned_from_fee_id != null && templateIdSet.has(row.cloned_from_fee_id)) {
      existing.add(cloneKey(row.customer_id, row.cloned_from_fee_id))
    }

    if (row.cloned_from_fee_id == null) {
      const k = legacyQueueKey(row.customer_id, row.fee_code, row.container_type)
      const arr = legacyQueues.get(k) ?? []
      arr.push(row.id)
      legacyQueues.set(k, arr)
    }
  }

  const toCreate: Prisma.feeCreateManyInput[] = []
  const toLink: { id: bigint; clonedFrom: bigint }[] = []
  let skipped = 0

  for (const c of customers) {
    for (const t of templates) {
      if (existing.has(cloneKey(c.id, t.id))) {
        skipped += 1
        continue
      }

      const k = legacyQueueKey(c.id, t.fee_code, t.container_type)
      const q = legacyQueues.get(k)
      if (q && q.length > 0) {
        const feeId = q.shift()!
        toLink.push({ id: feeId, clonedFrom: t.id })
        existing.add(cloneKey(c.id, t.id))
      } else {
        toCreate.push({
          fee_code: t.fee_code,
          fee_name: t.fee_name,
          unit: t.unit,
          unit_price: t.unit_price,
          currency: t.currency ?? 'USD',
          scope_type: 'customers',
          container_type: t.container_type,
          description: t.description,
          sort_order: t.sort_order ?? 0,
          customer_id: c.id,
          cloned_from_fee_id: t.id,
          created_by: userId,
          updated_by: userId,
        })
        existing.add(cloneKey(c.id, t.id))
      }
    }
  }

  const CHUNK = 50
  let linked = 0
  for (let i = 0; i < toLink.length; i += CHUNK) {
    const chunk = toLink.slice(i, i + CHUNK)
    await prisma.$transaction(
      chunk.map((u) =>
        prisma.fee.update({
          where: { id: u.id },
          data: { cloned_from_fee_id: u.clonedFrom, updated_by: userId },
        })
      )
    )
    linked += chunk.length
  }

  const wouldCreate = toCreate.length
  const BATCH = 250
  let created = 0
  for (let i = 0; i < toCreate.length; i += BATCH) {
    const chunk = toCreate.slice(i, i + BATCH)
    const result = await prisma.fee.createMany({ data: chunk })
    created += result.count
  }

  // 清理：同客户+编码+柜型下，若已有带 cloned_from（指向当前模板集）的行，则删掉仍无 cloned_from 的重复行
  let removedOrphans = 0
  const postFees = await prisma.fee.findMany({
    where: { customer_id: { in: customerIds }, scope_type: 'customers' },
    select: {
      id: true,
      customer_id: true,
      fee_code: true,
      container_type: true,
      cloned_from_fee_id: true,
    },
  })

  type GroupAgg = { hasTracked: boolean; orphanIds: bigint[] }
  const byKey = new Map<string, GroupAgg>()
  for (const row of postFees) {
    if (row.customer_id == null) continue
    const k = legacyQueueKey(row.customer_id, row.fee_code, row.container_type)
    let g = byKey.get(k)
    if (!g) {
      g = { hasTracked: false, orphanIds: [] }
      byKey.set(k, g)
    }
    if (row.cloned_from_fee_id != null && templateIdSet.has(row.cloned_from_fee_id)) {
      g.hasTracked = true
    } else if (row.cloned_from_fee_id == null) {
      g.orphanIds.push(row.id)
    }
  }

  const idsToDelete: bigint[] = []
  for (const g of byKey.values()) {
    if (g.hasTracked && g.orphanIds.length > 0) {
      idsToDelete.push(...g.orphanIds)
    }
  }

  for (let i = 0; i < idsToDelete.length; i += BATCH) {
    const slice = idsToDelete.slice(i, i + BATCH)
    const r = await prisma.fee.deleteMany({ where: { id: { in: slice } } })
    removedOrphans += r.count
  }

  return {
    created,
    skipped,
    linked,
    removedOrphans,
    templateCount: templates.length,
    customerCount: customers.length,
    wouldCreate,
  }
}
