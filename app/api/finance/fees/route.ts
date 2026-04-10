/**
 * 费用主数据 API 路由
 */

import { NextRequest, NextResponse } from 'next/server'
import { createListHandler, createCreateHandler } from '@/lib/crud/api-handler'
import { feeConfig } from '@/lib/crud/configs/fees'
import prisma from '@/lib/prisma'
import { checkPermission, serializeBigInt } from '@/lib/api/helpers'
import {
  listFeesForInvoiceLinePicker,
  type FeeForMatch,
} from '@/lib/finance/fee-matching'

const baseListHandler = createListHandler(feeConfig)
const baseCreateHandler = createCreateHandler(feeConfig)

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const forInvoiceLine = searchParams.get('for_invoice_line') === 'true'
  const customerIdParam = searchParams.get('customer_id')

  if (forInvoiceLine && customerIdParam) {
    const permissionResult = await checkPermission(feeConfig.permissions.list)
    if (permissionResult.error) return permissionResult.error

    const customerId = BigInt(customerIdParam)
    const containerType = searchParams.get('container_type')
    const search = (searchParams.get('search') || '').trim()

    const rawFees = await prisma.fee.findMany({
      where: {
        OR: [
          { customer_id: customerId },
          { scope_type: 'all' },
          { fee_scope: { some: { customer_id: customerId } } },
        ],
      },
      include: {
        customers: {
          select: { id: true, code: true, name: true },
        },
        fee_scope: { select: { customer_id: true } },
      },
      orderBy: [{ sort_order: 'asc' }, { fee_code: 'asc' }, { id: 'asc' }],
    })

    const resolved = listFeesForInvoiceLinePicker(
      rawFees as FeeForMatch[],
      customerId,
      containerType || null
    )

    let filtered = resolved
    if (search) {
      const q = search.toLowerCase()
      filtered = resolved.filter(
        (f) =>
          f.fee_code.toLowerCase().includes(q) ||
          f.fee_name.toLowerCase().includes(q)
      )
    }

    const payload = serializeBigInt(filtered)
    return NextResponse.json({
      data: payload,
      items: payload,
      page: 1,
      limit: filtered.length,
      total: filtered.length,
    })
  }

  return baseListHandler(request)
}

export async function POST(request: NextRequest) {
  return baseCreateHandler(request)
}
