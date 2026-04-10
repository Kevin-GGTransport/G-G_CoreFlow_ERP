/**
 * GET: 获取下一个直送账单发票号
 * 规则：S + 年月日(8) + 当天 4 位顺序号，如 S202603310001
 */

import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getNextDirectDeliveryNumber } from '@/lib/finance/next-direct-delivery-number'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }
    const nextNumber = await getNextDirectDeliveryNumber()
    return NextResponse.json({ data: { nextNumber } })
  } catch (error: any) {
    console.error('获取下一个直送发票号失败:', error)
    return NextResponse.json(
      { error: error?.message || '获取下一个直送发票号失败' },
      { status: 500 }
    )
  }
}
