/**
 * POST /api/finance/fees/batch-delete
 * 逐条删除并跳过已被账单引用的费用，返回成功/失败明细
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkPermission } from '@/lib/api/helpers'
import { feeConfig } from '@/lib/crud/configs/fees'
import { deleteFeeIfUnused } from '@/lib/finance/delete-fee'

export async function POST(request: NextRequest) {
  const perm = await checkPermission(feeConfig.permissions.delete ?? [])
  if (perm.error) return perm.error

  let body: { ids?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '请求体无效' }, { status: 400 })
  }

  const { ids } = body
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: '请提供要删除的记录 ID 列表' }, { status: 400 })
  }

  const failed: { id: string; error: string }[] = []
  let deleted = 0

  for (const raw of ids) {
    const idStr = String(raw).trim()
    if (!/^\d+$/.test(idStr)) {
      failed.push({ id: idStr, error: '无效的 ID' })
      continue
    }
    try {
      const result = await deleteFeeIfUnused(BigInt(idStr))
      if (result.ok) {
        deleted += 1
      } else {
        failed.push({ id: idStr, error: result.error })
      }
    } catch (e: unknown) {
      failed.push({
        id: idStr,
        error: e instanceof Error ? e.message : '删除失败',
      })
    }
  }

  const message =
    failed.length === 0
      ? `成功删除 ${deleted} 条费用记录`
      : deleted > 0
        ? `已删除 ${deleted} 条，${failed.length} 条未能删除（多为已被账单引用）`
        : failed.length === ids.length
          ? '所选记录均未删除：可能已被账单明细引用'
          : `部分未删除：${failed.length} 条`

  return NextResponse.json({
    message,
    deleted,
    failed,
  })
}
