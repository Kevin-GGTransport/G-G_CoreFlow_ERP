/**
 * POST /api/finance/invoices/create-from-container
 * 按柜号（订单 order_number）查找订单；操作方式为直送则 1:1 同步直送账单（与订单新建逻辑一致）。
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkPermission, serializeBigInt } from '@/lib/api/helpers'
import { invoiceConfig } from '@/lib/crud/configs/invoices'
import prisma from '@/lib/prisma'
import { syncDirectDeliveryInvoiceForOrder } from '@/lib/finance/direct-delivery-sync'
import {
  ORDER_STATUS_CANCELLED,
  ORDER_STATUS_CANCELED_US,
} from '@/lib/orders/order-visibility'

export async function POST(request: NextRequest) {
  try {
    const perm = await checkPermission(invoiceConfig.permissions.create ?? [])
    if (perm.error) return perm.error

    const body = await request.json().catch(() => ({}))
    const raw = typeof body.container_number === 'string' ? body.container_number : ''
    const container_number = raw.trim()
    if (!container_number) {
      return NextResponse.json({ error: '请输入柜号' }, { status: 400 })
    }

    const userId = perm.user?.id != null ? BigInt(perm.user.id) : null

    const order = await prisma.orders.findFirst({
      where: {
        order_number: { equals: container_number, mode: 'insensitive' },
      },
      select: {
        order_id: true,
        customer_id: true,
        order_number: true,
        operation_mode: true,
        status: true,
      },
      orderBy: { order_id: 'desc' },
    })

    if (!order) {
      return NextResponse.json({ error: '未找到该柜号对应的订单' }, { status: 404 })
    }

    if (order.customer_id == null) {
      return NextResponse.json({ error: '该订单未关联客户，无法创建账单' }, { status: 400 })
    }

    if (
      order.status === ORDER_STATUS_CANCELLED ||
      order.status === ORDER_STATUS_CANCELED_US
    ) {
      return NextResponse.json({ error: '该订单已取消，不生成直送账单' }, { status: 400 })
    }

    if (order.operation_mode !== 'direct_delivery') {
      return NextResponse.json({ error: '该订单非直送订单（操作方式需为直送）' }, { status: 400 })
    }

    const result = await syncDirectDeliveryInvoiceForOrder(order.order_id, userId)
    if (!result.ok || result.invoice_id == null) {
      return NextResponse.json(
        { error: result.error ?? '同步直送账单失败' },
        { status: 500 }
      )
    }

    const invoice = await prisma.invoices.findUnique({
      where: { invoice_id: result.invoice_id },
    })

    return NextResponse.json({
      data: invoice ? serializeBigInt(invoice) : null,
      order_number: order.order_number,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '创建直送账单失败'
    console.error('[create-from-container]', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
