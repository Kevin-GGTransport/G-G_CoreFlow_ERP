/**
 * 一次性：删除「关联订单状态为已取消」的直送账单（含明细；应收等随发票级联删除）。
 *
 * 用法：
 *   pnpm exec tsx scripts/cleanup-direct-delivery-invoices-for-cancelled-orders.ts
 *   pnpm exec tsx scripts/cleanup-direct-delivery-invoices-for-cancelled-orders.ts --dry-run
 *
 * 按柜号只删一单（订单须为已取消；否则需加 --force）：
 *   pnpm exec tsx scripts/cleanup-direct-delivery-invoices-for-cancelled-orders.ts --order-number=柜号
 */

import * as dotenv from 'dotenv'
import * as path from 'path'
import { fileURLToPath } from 'url'
import prisma from '../lib/prisma'
import { isOrderCancelledStatus } from '../lib/orders/order-visibility'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.resolve(__dirname, '../.env') })
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const dryRun = process.argv.includes('--dry-run')

function parseArg(name: string): string | undefined {
  const p = process.argv.find((a) => a.startsWith(`${name}=`))
  if (!p) return undefined
  return p.slice(name.length + 1).trim()
}

async function deleteByOrderNumber(container: string) {
  const order = await prisma.orders.findFirst({
    where: { order_number: { equals: container, mode: 'insensitive' } },
    select: { order_id: true, order_number: true, status: true },
    orderBy: { order_id: 'desc' },
  })
  if (!order) {
    console.error(`未找到柜号/订单号: ${container}`)
    process.exit(1)
  }

  const force = process.argv.includes('--force')
  if (!isCancelledStatus(order.status) && !force) {
    console.error(
      `订单 ${order.order_number} 状态为「${order.status ?? '空'}」，非已取消。确认仍要删直送账单请加 --force`
    )
    process.exit(1)
  }

  const inv = await prisma.invoices.findFirst({
    where: { order_id: order.order_id, invoice_type: 'direct_delivery' },
    select: { invoice_id: true, invoice_number: true },
  })
  if (!inv) {
    console.log(`订单 ${order.order_number} 下无直送账单，无需删除。`)
    await prisma.$disconnect()
    return
  }

  console.log(
    `将删除直送账单 invoice_id=${inv.invoice_id} invoice_number=${inv.invoice_number}（订单 ${order.order_number} status=${order.status}）`
  )
  if (dryRun) {
    console.log('[--dry-run] 未执行删除。')
    await prisma.$disconnect()
    return
  }

  await prisma.invoices.delete({ where: { invoice_id: inv.invoice_id } })
  console.log('已删除。')
  await prisma.$disconnect()
}

async function main() {
  const orderNumberArg = parseArg('--order-number')
  if (orderNumberArg) {
    await deleteByOrderNumber(orderNumberArg)
    return
  }

  // 拉全量后在内存里用 isOrderCancelledStatus 过滤，避免 Prisma/DB 与业务判断不一致导致漏删
  const candidates = await prisma.invoices.findMany({
    where: { invoice_type: 'direct_delivery' },
    select: {
      invoice_id: true,
      invoice_number: true,
      order_id: true,
      orders: { select: { order_number: true, status: true } },
    },
  })
  const victims = candidates.filter((row) => isOrderCancelledStatus(row.orders?.status))

  console.log(`将删除直送账单数: ${victims.length}`)
  if (victims.length > 0) {
    console.log(
      '将删列表（前 20 条）:',
      victims.slice(0, 20).map((v) => ({
        invoice_number: v.invoice_number,
        order_number: v.orders?.order_number,
        order_status: v.orders?.status,
      }))
    )
  }

  if (dryRun) {
    console.log('\n[--dry-run] 未执行删除。')
    await prisma.$disconnect()
    return
  }

  const ids = victims.map((v) => v.invoice_id)
  if (ids.length === 0) {
    await prisma.$disconnect()
    return
  }

  const deleted = await prisma.invoices.deleteMany({
    where: {
      invoice_id: { in: ids },
      invoice_type: 'direct_delivery',
    },
  })

  console.log(`\n已删除 invoices 行数: ${deleted.count}`)
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
