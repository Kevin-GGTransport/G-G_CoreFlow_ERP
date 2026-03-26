/**
 * 用于未约板数、剩余板数、送货进度等公式的「基准板数」：
 * - `null` / `undefined`：未录入实际板数 → 按订单明细「预计板数」作基准（与入库详情留空一致）。
 * - `0`：明确录入为零 → 基准为 0，参与未约/剩余/进度计算。
 * - 正整数：按实际值。
 */
export function basePalletCountForCalc(
  palletCount: number | null | undefined,
  estimatedPallets: number | null | undefined
): number {
  if (palletCount === null || palletCount === undefined) {
    return estimatedPallets ?? 0
  }
  const n = Number(palletCount)
  if (Number.isNaN(n)) {
    return estimatedPallets ?? 0
  }
  return n
}
