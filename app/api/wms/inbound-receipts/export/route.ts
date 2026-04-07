import { NextRequest, NextResponse } from 'next/server'
import {
  checkPermission,
  WMS_FULL_ACCESS_PERMISSION_OPTIONS,
} from '@/lib/api/helpers'
import { inboundReceiptConfig } from '@/lib/crud/configs/inbound-receipts'
import { runInboundReceiptListQuery } from '@/lib/wms/inbound-receipts-list-query'
import { generateInboundReceiptExportExcel } from '@/lib/utils/inbound-receipt-export-excel'

/**
 * GET /api/wms/inbound-receipts/export
 * 与列表相同的筛选/搜索/高级搜索参数；结果按拆柜日期升序（未填拆柜日期的行在最后）；最多 5 万行。
 */
export async function GET(request: NextRequest) {
  try {
    const permissionResult = await checkPermission(
      inboundReceiptConfig.permissions.list,
      WMS_FULL_ACCESS_PERMISSION_OPTIONS
    )
    if (permissionResult.error) return permissionResult.error

    const { searchParams } = new URL(request.url)
    const { data } = await runInboundReceiptListQuery(searchParams, { type: 'export' })

    const workbook = await generateInboundReceiptExportExcel(data)
    const buffer = await workbook.xlsx.writeBuffer()
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
    const filename = `入库管理_按拆柜日期_${timestamp}`

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}.xlsx"`,
      },
    })
  } catch (e) {
    console.error('[inbound-receipts export]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '导出失败' },
      { status: 500 }
    )
  }
}
