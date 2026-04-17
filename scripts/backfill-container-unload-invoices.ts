/**
 * 一次性：为所有「操作方式 = 拆柜 (unload)」的订单补建拆柜账单及明细（与线上一致逻辑 syncContainerUnloadInvoiceForOrder）。
 *
 * 规则：**排除仅「已取消」**；**完成留档 (archived) 与在途单一样参与补数**（与直送补数脚本一致）。
 *
 * 用法：
 *   pnpm exec tsx scripts/backfill-container-unload-invoices.ts
 *   pnpm exec tsx scripts/backfill-container-unload-invoices.ts --dry-run
 *   pnpm exec tsx scripts/backfill-container-unload-invoices.ts --reset-first   # 先清空全部拆柜账单再按订单重算（级联删除明细、应收及核销分配）
 */

import * as dotenv from 'dotenv'
import * as path from 'path'
import { fileURLToPath } from 'url'
import prisma from '../lib/prisma'
import { syncContainerUnloadInvoiceForOrder } from '../lib/finance/container-unload-sync'
import { ordersWhereRootExcludeCancelledOnly } from '../lib/orders/order-visibility'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.resolve(__dirname, '../.env') })
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const dryRun = process.argv.includes('--dry-run')
const resetFirst = process.argv.includes('--reset-first')

async function main() {
  if (resetFirst) {
    const countUnload = await prisma.invoices.count({ where: { invoice_type: 'unload' } })
    if (dryRun) {
      console.log(`[--dry-run --reset-first] 将删除拆柜账单 ${countUnload} 条（invoice_type=unload），然后对拆柜订单重算。`)
    } else {
      const deleted = await prisma.invoices.deleteMany({ where: { invoice_type: 'unload' } })
      console.log(`已清空拆柜账单: deleteMany count=${deleted.count}（原 unload 发票约 ${countUnload} 条）`)
    }
  }

  const orders = await prisma.orders.findMany({
    where: {
      operation_mode: 'unload',
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
    `拆柜订单总数: ${orders.length}（有客户 ${withCustomer.length}，无客户跳过 ${noCustomer}）` +
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
    const r = await syncContainerUnloadInvoiceForOrder(o.order_id, null)
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
