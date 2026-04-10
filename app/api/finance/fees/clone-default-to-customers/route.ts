/**
 * POST /api/finance/fees/clone-default-to-customers
 * 按客户复制「所有客户」默认费用为「指定客户」+ customer_id，已存在则跳过。
 */

import { NextResponse } from 'next/server'
import { checkPermission } from '@/lib/api/helpers'
import { feeConfig } from '@/lib/crud/configs/fees'
import { cloneDefaultFeesToCustomers } from '@/lib/finance/clone-default-fees-to-customers'

export async function POST() {
  try {
    const perm = await checkPermission(feeConfig.permissions.create ?? [])
    if (perm.error) return perm.error

    const userId = perm.user?.id
    if (!userId) {
      return NextResponse.json({ error: '无法识别当前用户' }, { status: 401 })
    }

    const result = await cloneDefaultFeesToCustomers(BigInt(userId))

    const message =
      result.templateCount === 0
        ? '没有「所有客户」模板费用（scope_type=all 且未绑定客户），未生成任何记录'
        : result.customerCount === 0
          ? '系统中没有客户，未生成任何记录'
          : [
              result.created > 0 ? `新建 ${result.created} 条` : null,
              result.linked > 0 ? `为旧数据补标来源 ${result.linked} 条` : null,
              result.skipped > 0 ? `跳过（已有模板副本）${result.skipped} 条` : null,
              result.removedOrphans > 0 ? `清理重复旧行 ${result.removedOrphans} 条` : null,
            ]
              .filter(Boolean)
              .join('；') || '无变更（均已对齐模板）'

    return NextResponse.json({
      ...result,
      message,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '复制默认费用失败'
    console.error('[clone-default-to-customers]', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
