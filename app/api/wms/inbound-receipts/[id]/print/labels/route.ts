/**
 * GET /api/wms/inbound-receipts/[id]/print/labels
 * 生成入库管理的 Label PDF
 * 
 * 支持调用方式：
 * 1. 详情页：前端传递 orderDetails, containerNumber, customerCode, plannedUnloadDate
 * 2. 批量操作：无 query 时根据 id 从数据库加载
 * 3. 单条明细：`?single=1&orderDetailId={id}` — 仅生成该明细对应仓点的 **1 页** PDF（服务端校验归属当前入库单）
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkAuth, checkPermission, WMS_FULL_ACCESS_PERMISSION_OPTIONS, handleError } from '@/lib/api/helpers'
import { inboundReceiptConfig } from '@/lib/crud/configs/inbound-receipts'
import { generateLabelsPDF } from '@/lib/services/print/label.service'
import { getLabelSecondRowAndBarcode } from '@/lib/services/print/label-utils'
import { LabelData } from '@/lib/services/print/types'
import { loadInboundReceiptForPrint } from '../load-receipt-for-print'
import prisma from '@/lib/prisma'

function formatDateYmd(v: Date | string | null | undefined): string {
  if (v == null) return ''
  if (typeof v === 'string') return v.split('T')[0] || ''
  try {
    return new Date(v).toISOString().split('T')[0]
  } catch {
    return ''
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let resolvedParams: { id: string } | null = null
  try {
    const authResult = await checkAuth()
    if (authResult.error) return authResult.error

    const permissionResult = await checkPermission(inboundReceiptConfig.permissions.list, WMS_FULL_ACCESS_PERMISSION_OPTIONS)
    if (permissionResult.error) return permissionResult.error

    resolvedParams = await params
    const searchParams = request.nextUrl.searchParams

    /** 详情页：仅生成某一订单明细对应仓点的 1 张 label（单页 PDF） */
    const single = searchParams.get('single') === '1'
    const orderDetailIdParam = searchParams.get('orderDetailId')
    if (single && orderDetailIdParam && resolvedParams?.id) {
      let orderDetailId: bigint
      try {
        orderDetailId = BigInt(orderDetailIdParam)
      } catch {
        return NextResponse.json({ error: '无效的 orderDetailId' }, { status: 400 })
      }

      const inboundReceiptId = BigInt(resolvedParams.id)
      const [ir, od] = await Promise.all([
        prisma.inbound_receipt.findUnique({
          where: { inbound_receipt_id: inboundReceiptId },
          select: {
            order_id: true,
            planned_unload_at: true,
            orders: {
              select: {
                order_number: true,
                customers: { select: { code: true } },
              },
            },
          },
        }),
        prisma.order_detail.findUnique({
          where: { id: orderDetailId },
          select: {
            id: true,
            order_id: true,
            estimated_pallets: true,
            delivery_nature: true,
            notes: true,
            locations_order_detail_delivery_location_idTolocations: {
              select: { location_code: true, name: true },
            },
          },
        }),
      ])

      if (!ir || !od || od.order_id == null || ir.order_id !== od.order_id) {
        return NextResponse.json(
          { error: '入库单与订单明细不匹配或数据不存在' },
          { status: 404 }
        )
      }

      const containerNumber = ir.orders?.order_number || ''
      const customerCode = ir.orders?.customers?.code || ''
      const plannedUnloadDate = formatDateYmd(ir.planned_unload_at)

      const loc = od.locations_order_detail_delivery_location_idTolocations
      const deliveryLocation = (loc?.location_code || loc?.name || '').trim()
      if (!deliveryLocation) {
        return NextResponse.json({ error: '该明细未维护仓点，无法生成标签' }, { status: 400 })
      }
      if (!customerCode) {
        return NextResponse.json({ error: '缺少客户代码' }, { status: 400 })
      }

      const estimatedPallets = od.estimated_pallets != null ? Number(od.estimated_pallets) : 1
      const deliveryNature = od.delivery_nature || undefined
      const notes = od.notes || ''

      const { barcode } = getLabelSecondRowAndBarcode(
        containerNumber,
        deliveryLocation,
        deliveryNature,
        notes
      )

      const labelData: LabelData = {
        containerNumber,
        deliveryLocation,
        deliveryLocationCode: deliveryLocation,
        deliveryNature: deliveryNature || undefined,
        notes: notes || undefined,
        barcode,
        customerCode,
        plannedUnloadDate,
        orderDetailId: String(od.id),
        estimatedPallets: Number.isFinite(estimatedPallets) ? estimatedPallets : 1,
      }

      const pdfBuffer = await generateLabelsPDF([labelData])
      const safeLoc = deliveryLocation.replace(/[/\\?%*:|"<>]/g, '-').slice(0, 40)
      const filename = `${containerNumber || 'label'}-${safeLoc}-single.pdf`
      return new NextResponse(pdfBuffer as any, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="${encodeURIComponent(filename)}"`,
        },
      })
    }

    let orderDetails: any[]
    let containerNumber: string
    let customerCode: string
    let plannedUnloadDate: string

    const orderDetailsJson = searchParams.get('orderDetails')
    if (orderDetailsJson && searchParams.get('containerNumber') && searchParams.get('customerCode') && searchParams.get('plannedUnloadDate')) {
      containerNumber = searchParams.get('containerNumber')!
      customerCode = searchParams.get('customerCode')!
      plannedUnloadDate = searchParams.get('plannedUnloadDate')!
      orderDetails = JSON.parse(orderDetailsJson)
      if (!Array.isArray(orderDetails) || orderDetails.length === 0) {
        return NextResponse.json({ error: '订单明细数据不能为空' }, { status: 400 })
      }
    } else {
      const loaded = await loadInboundReceiptForPrint(resolvedParams.id)
      if (!loaded || loaded.orderDetails.length === 0) {
        return NextResponse.json(
          { error: '入库单不存在或没有订单明细' },
          { status: 404 }
        )
      }
      containerNumber = loaded.containerNumber
      customerCode = loaded.customerCode
      plannedUnloadDate = loaded.plannedUnloadDate
      orderDetails = loaded.orderDetails
    }

    // 生成 Label 数据
    const labels: LabelData[] = []
    for (const detail of orderDetails) {
      const deliveryLocation = detail.delivery_location || detail.deliveryLocation || ''
      const deliveryLocationCode = deliveryLocation
      const estimatedPallets = detail.estimated_pallets || detail.estimatedPallets || 1
      const deliveryNature = detail.delivery_nature || detail.deliveryNature || undefined
      const notes = detail.notes || '' // 获取备注字段

      if (!deliveryLocationCode) {
        continue // 跳过没有仓点的明细
      }

      const { secondRow, barcode } = getLabelSecondRowAndBarcode(
        containerNumber || '',
        deliveryLocation,
        deliveryNature,
        notes
      )

      const labelData: LabelData = {
        containerNumber,
        deliveryLocation,
        deliveryLocationCode,
        deliveryNature: deliveryNature || undefined,
        notes: notes || undefined, // 添加备注字段
        barcode,
        customerCode,
        plannedUnloadDate,
        orderDetailId: detail.id?.toString() || detail.order_detail_id?.toString() || '',
        estimatedPallets: Number(estimatedPallets),
      }

      // 根据预计板数生成多个相同的 Label（预计板数 * 4）
      const labelCount = Number(estimatedPallets) * 4
      for (let i = 0; i < labelCount; i++) {
        labels.push({ ...labelData })
      }
    }

    if (labels.length === 0) {
      return NextResponse.json(
        { error: '无法生成 Label，请检查数据完整性' },
        { status: 400 }
      )
    }

    // 生成 PDF
    const pdfBuffer = await generateLabelsPDF(labels)

    // 返回 PDF（文件名格式：{柜号}-label.pdf）
    const filename = `${containerNumber}-label.pdf`
    return new NextResponse(pdfBuffer as any, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${encodeURIComponent(filename)}"`,
      },
    })
  } catch (error: any) {
    console.error('[Labels Print] 生成失败:', {
      error,
      message: error?.message,
      stack: error?.stack,
      inboundReceiptId: resolvedParams?.id || 'unknown',
    })
    return handleError(error, '生成 Label PDF 失败')
  }
}

