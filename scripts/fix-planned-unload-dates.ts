/**
 * 执行与 POST /api/wms/inbound-receipts/fix-planned-unload-dates 相同的数据库修复。
 *
 * 用法：npx tsx scripts/fix-planned-unload-dates.ts
 */

import './load-project-env'
import prisma from '../lib/prisma'
import { runFixPlannedUnloadDates } from '../lib/wms/run-fix-planned-unload-dates'

async function main() {
  console.log('开始修复入库拆柜日期（查验清脏数据 + 空日期回填）...\n')
  const result = await runFixPlannedUnloadDates()
  console.log(JSON.stringify(result, null, 2))
  if (result.errors.length > 0 && result.errors.length <= 30) {
    console.log('\n失败/无法计算明细:')
    for (const e of result.errors) {
      console.log(`  ${e.order_number} (${e.inbound_receipt_id}): ${e.error}`)
    }
  } else if (result.errors.length > 30) {
    console.log(`\n（省略 ${result.errors.length} 条错误明细，请查 JSON 输出）`)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
