/**
 * 一次性：为所有「操作方式 = 直送」的订单补建直送账单及明细（与线上一致逻辑 syncDirectDeliveryInvoiceForOrder）。
 *
 * 规则：**排除仅「已取消」**；**完成留档 (archived) 与在途单一样参与补数**（与直送账单业务规则一致）。
 *
 * 用法：
 *   pnpm exec tsx scripts/backfill-direct-delivery-invoices.ts
 *   pnpm exec tsx scripts/backfill-direct-delivery-invoices.ts --dry-run
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
  const noCustomer = orders.length - withCustomer.length

  console.log(
    `直送订单总数: ${orders.length}（有客户 ${withCustomer.length}，无客户跳过 ${noCustomer}）` +
      ' [不含已取消；含完成留档]'
  )

  if (dryRun) {
    console.log('\n[--dry-run] 前 20 条将处理的订单号:')
    withCustomer.slice(0, 20).forEach((o) => console.log(`  ${o.order_number} (order_id=${o.order_id})`))
    if (withCustomer.length > 20) console.log(`  ... 共 ${withCustomer.length} 条`)
    console.log('\n去掉 --dry-run 后执行补全。')
    await prisma.$disconnect()
    return
  }

  let ok = 0
  let fail = 0
  for (const o of withCustomer) {
    const r = await syncDirectDeliveryInvoiceForOrder(o.order_id, null)
    if (r.ok) {
      ok++
      console.log(`OK ${o.order_number} -> invoice_id=${r.invoice_id}`)
    } else {
      fail++
      console.error(`FAIL ${o.order_number}: ${r.error}`)
    }
  }

  console.log(`\n完成: 成功 ${ok}, 失败 ${fail}`)
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
