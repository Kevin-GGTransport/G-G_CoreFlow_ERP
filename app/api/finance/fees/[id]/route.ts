/**
 * 费用详情/更新/删除 API 路由
 * 删除：先检查是否被发票明细引用，避免外键错误无提示
 */

import { NextRequest, NextResponse } from 'next/server'
import { createDetailHandler, createUpdateHandler } from '@/lib/crud/api-handler'
import { checkPermission } from '@/lib/api/helpers'
import { feeConfig } from '@/lib/crud/configs/fees'
import { deleteFeeIfUnused } from '@/lib/finance/delete-fee'

const baseDetailHandler = createDetailHandler(feeConfig)
const baseUpdateHandler = createUpdateHandler(feeConfig)

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return baseDetailHandler(request, { params })
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return baseUpdateHandler(request, { params })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const perm = await checkPermission(feeConfig.permissions.delete ?? [])
    if (perm.error) return perm.error

    const { id } = await params
    if (!id || !/^\d+$/.test(String(id))) {
      return NextResponse.json({ error: '无效的费用 ID' }, { status: 400 })
    }

    const result = await deleteFeeIfUnused(BigInt(id))
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, lineCount: result.lineCount },
        { status: 409 }
      )
    }

    return NextResponse.json({ message: '删除费用成功' })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '删除费用失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
