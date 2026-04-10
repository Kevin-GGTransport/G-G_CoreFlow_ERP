/**
 * 费用批量导入 Service
 */

import prisma from '@/lib/prisma'
import { BaseImportService } from './import/base-import.service'
import { ImportConfig, ImportError } from './import/types'
import { feeImportRowSchema, FeeImportRow } from '@/lib/validations/fee-import'

const feeImportConfig: ImportConfig<FeeImportRow> = {
  headerMap: {
    '费用编码': 'fee_code',
    '费用名称': 'fee_name',
    '单位': 'unit',
    '单价': 'unit_price',
    '币种': 'currency',
    '归属范围': 'scope_type',
    '柜型': 'container_type',
    '说明': 'description',
  },

  validationSchema: feeImportRowSchema,

  requiredRoles: ['admin', 'oms_manager'],

  executeImport: async (data: FeeImportRow[], userId: bigint): Promise<void> => {
    if (data.length === 0) return

    const mapRow = (row: FeeImportRow) => ({
      fee_code: row.fee_code,
      fee_name: row.fee_name,
      unit: row.unit ?? null,
      unit_price: row.unit_price,
      currency: row.currency ?? 'USD',
      scope_type: row.scope_type,
      container_type: row.container_type ?? null,
      description: row.description ?? null,
      created_by: userId,
      updated_by: userId,
    })

    // 避免 interactive $transaction(async tx => …)：在 Neon/PgBouncer 等池化连接上易出现
    // “Transaction not found / Transaction ID is invalid”。
    // 使用 createMany + 数组式 $transaction，由 Prisma 在同一连接上顺序执行，兼容池化。
    const BATCH = 250
    const operations = []
    for (let i = 0; i < data.length; i += BATCH) {
      const slice = data.slice(i, i + BATCH).map(mapRow)
      operations.push(prisma.fee.createMany({ data: slice }))
    }

    if (operations.length === 1) {
      await operations[0]
    } else {
      await prisma.$transaction(operations)
    }
  },
}

export const feeImportService = new BaseImportService(feeImportConfig)
