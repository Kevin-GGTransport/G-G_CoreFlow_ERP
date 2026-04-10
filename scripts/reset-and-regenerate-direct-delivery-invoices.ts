/**
 * 清空「直送账单」管理中的数据（invoice_type = direct_delivery），
 * 再为所有符合条件的直送订单调用 syncDirectDeliveryInvoiceForOrder 重新生成。
 *
 * 删除 invoices 时：invoice_line_items、关联 receivables 及 payment_allocations 由 Prisma/DB 级联处理。
 *
 * 规则与 backfill-direct-delivery-invoices 一致：**排除已取消**；**完成留档仍参与**；无客户订单跳过同步。
 *
 * 用法:
 *   pnpm exec tsx scripts/reset-and-regenerate-direct-delivery-invoices.ts --dry-run
 *   pnpm exec tsx scripts/reset-and-regenerate-direct-delivery-invoices.ts
 */

import * as dotenv from 'dotenv'
import * as path from 'path'
import { fileURLToPath } from 'url'
import prisma from '../lib/prisma'
import { syncDirectDeliveryInvoiceForOrder } from '../lib/finance/direct-delivery-sync'
import { ordersWhereRootExcludeCancelledOnly } from '../lib/orders/order-visibility'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.resolve(__dirname, '../.env') })
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const dryRun = process.argv.includes('--dry-run')

async function main() {
  const beforeCount = await prisma.invoices.count({
    where: { invoice_type: 'direct_delivery' },
  })
  console.log(`当前直送账单条数: ${beforeCount}`)

  if (dryRun) {
    const orders = await prisma.orders.findMany({
      where: {
        operation_mode: 'direct_delivery',
        ...ordersWhereRootExcludeCancelledOnly(),
      },
      select: { order_id: true, order_number: true, customer_id: true },
      orderBy: { order_id: 'asc' },
    })
    const withCustomer = orders.filter((o) => o.customer_id != null)
    console.log(
      `[--dry-run] 将删除 ${beforeCount} 条直送账单，然后对 ${withCustomer.length} 个有客户的直送订单重新同步（无客户 ${orders.length - withCustomer.length} 条跳过）。`
    )
    console.log('去掉 --dry-run 后执行清空与重算。')
    await prisma.$disconnect()
    return
  }

  const deleted = await prisma.invoices.deleteMany({
    where: { invoice_type: 'direct_delivery' },
  })
  console.log(`已删除直送账单: ${deleted.count} 条`)

  const orders = await prisma.orders.findMany({
    where: {
      operation_mode: 'direct_delivery',
      ...ordersWhereRootExcludeCancelledOnly(),
    },
    select: {
      order_id: true,
      order_number: true,
      customer_id: true,
    },
    orderBy: { order_id: 'asc' },
  })

  const withCustomer = orders.filter((o) => o.customer_id != null)
  console.log(
    `直送订单（将同步）: ${withCustomer.length}（无客户跳过 ${orders.length - withCustomer.length}）`
  )

  let ok = 0
  let fail = 0
  const total = withCustomer.length
  for (let i = 0; i < withCustomer.length; i++) {
    const o = withCustomer[i]!
    const r = await syncDirectDeliveryInvoiceForOrder(o.order_id, null)
    if (r.ok) {
      ok++
      const n = i + 1
      if (n % 100 === 0 || n === total) {
        console.log(`进度 ${n}/${total}（已同步 ${ok} 单${fail ? `，失败 ${fail}` : ''}）`)
      }
    } else {
      fail++
      console.error(`FAIL ${o.order_number}: ${r.error}`)
    }
  }

  console.log(`\n完成: 删除直送账单 ${deleted.count} 条；重新生成 成功 ${ok}, 失败 ${fail}`)
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
