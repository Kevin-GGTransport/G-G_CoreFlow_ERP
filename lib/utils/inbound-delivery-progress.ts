/**
 * 入库/订单侧「送货进度、剩余板数、未约板数」统一口径（预约已到期有效板数 vs 基准板数）。
 * 被入库主表/详情 API、订单明细 API、库存明细列表、运营追踪等复用。
 */
import { basePalletCountForCalc } from '@/lib/utils/pallet-base'

/** 与入库详情页预约结构兼容（前端 appointments 或 Prisma appointment_detail_lines） */
export type InboundAppointmentInput = {
  confirmed_start?: string | Date | null
  estimated_pallets?: number | null
  rejected_pallets?: number | null
}

export type InboundLotPalletInput = {
  pallet_count?: number | null
}

export function effectiveAppointmentPallets(appt: InboundAppointmentInput): number {
  return (appt.estimated_pallets ?? 0) - (appt.rejected_pallets ?? 0)
}

/** 已到期（含当日）预约的有效板数合计，与 computeInboundOrderDetailDeliveryState 内口径一致 */
export function getTotalExpiredEffectivePallets(appointments: InboundAppointmentInput[]): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const expiredAppointments = appointments.filter((appt) => {
    const start = appt.confirmed_start
    if (!start) return false
    const d = new Date(start as string | Date)
    if (Number.isNaN(d.getTime())) return false
    d.setHours(0, 0, 0, 0)
    return d <= today
  })
  return expiredAppointments.reduce((sum, appt) => sum + effectiveAppointmentPallets(appt), 0)
}

/** 从订单明细解析预约列表（支持详情页扁平 appointments 或 API 嵌套 appointment_detail_lines） */
export function resolveAppointmentsFromOrderDetail(detail: any): InboundAppointmentInput[] {
  if (Array.isArray(detail?.appointments)) {
    return detail.appointments.map((a: any) => ({
      confirmed_start: a.confirmed_start,
      estimated_pallets: a.estimated_pallets,
      rejected_pallets: a.rejected_pallets ?? 0,
    }))
  }
  const lines = detail?.appointment_detail_lines || []
  return lines
    .filter((line: any) => line?.delivery_appointments != null)
    .map((line: any) => ({
      confirmed_start: line.delivery_appointments?.confirmed_start,
      estimated_pallets: line.estimated_pallets,
      rejected_pallets: line.rejected_pallets ?? 0,
    }))
}

/**
 * 与入库详情「仓点明细」getInventoryInfo 一致：
 * 剩余 = 基准板数 − 已到期（含当日）预约有效板数；进度 = 剩余为 0 则 100%，否则 (基准−剩余)/基准。
 * 无 inventory_lots 时返回 null。
 */
export function computeInboundOrderDetailDeliveryState(input: {
  lots: InboundLotPalletInput[]
  estimatedPallets: number | null | undefined
  appointments: InboundAppointmentInput[]
}): {
  totalPalletCount: number
  totalRemainingPalletCount: number
  totalUnbookedPalletCount: number
  deliveryProgress: number
} | null {
  const { lots, estimatedPallets, appointments } = input
  if (lots.length === 0) return null

  const estimated = estimatedPallets ?? null
  const rawPalletSum = lots.reduce((sum, lot) => sum + (Number(lot.pallet_count) || 0), 0)
  const totalPalletCount =
    lots.length === 1
      ? basePalletCountForCalc(lots[0].pallet_count, estimated)
      : rawPalletSum === 0
        ? (estimated ?? 0)
        : rawPalletSum

  const totalExpiredEffectivePallets = getTotalExpiredEffectivePallets(appointments)
  const totalRemainingPalletCount = totalPalletCount - totalExpiredEffectivePallets

  const totalAppointmentPallets = appointments.reduce(
    (sum, appt) => sum + effectiveAppointmentPallets(appt),
    0
  )
  const totalUnbookedPalletCount = totalPalletCount - totalAppointmentPallets

  let deliveryProgress: number
  if (totalPalletCount > 0) {
    if (totalRemainingPalletCount === 0) {
      deliveryProgress = 100
    } else {
      const shipped = totalPalletCount - totalRemainingPalletCount
      deliveryProgress = Math.round((shipped / totalPalletCount) * 100 * 100) / 100
      deliveryProgress = Math.max(0, Math.min(100, deliveryProgress))
    }
  } else {
    deliveryProgress = 0
  }

  return {
    totalPalletCount,
    totalRemainingPalletCount,
    totalUnbookedPalletCount,
    deliveryProgress,
  }
}

/**
 * 入库主表送货进度：对每个有库存明细的订单明细行用上面规则算进度，再按该行基准板数加权平均
 * （与详情页各明细行展示一致）。
 */
export function computeInboundReceiptHeaderDeliveryProgress(input: {
  orderDetails: any[]
  inventoryLots: { order_detail_id: any; pallet_count?: any }[]
}): number {
  const { orderDetails, inventoryLots } = input
  const lotsByDetailId = new Map<string, InboundLotPalletInput[]>()
  for (const lot of inventoryLots) {
    const id = String(lot.order_detail_id)
    if (!lotsByDetailId.has(id)) lotsByDetailId.set(id, [])
    lotsByDetailId.get(id)!.push({ pallet_count: lot.pallet_count })
  }

  let weightedSum = 0
  let weightTotal = 0

  for (const detail of orderDetails || []) {
    const id = String(detail.id)
    const lots = lotsByDetailId.get(id) || []
    const appointments = resolveAppointmentsFromOrderDetail(detail)
    const state = computeInboundOrderDetailDeliveryState({
      lots,
      estimatedPallets: detail.estimated_pallets,
      appointments,
    })
    if (state == null) continue
    if (state.totalPalletCount <= 0) continue
    weightedSum += state.deliveryProgress * state.totalPalletCount
    weightTotal += state.totalPalletCount
  }

  if (weightTotal <= 0) return 0
  return Math.round((weightedSum / weightTotal) * 100) / 100
}
