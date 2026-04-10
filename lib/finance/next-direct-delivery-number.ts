/**
 * 直送账单发票号：S + 年月日(8) + 当天 4 位顺序号
 * 例：S202603310001
 */

import prisma from '@/lib/prisma'

export async function getNextDirectDeliveryNumber(date: Date = new Date()): Promise<string> {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const prefix = `S${yyyy}${mm}${dd}`

  const list = await prisma.invoices.findMany({
    where: {
      invoice_type: 'direct_delivery',
      invoice_number: { startsWith: prefix },
    },
    select: { invoice_number: true },
    orderBy: { invoice_number: 'desc' },
    take: 1,
  })

  let nextSeq = 1
  if (list.length > 0) {
    const last = list[0].invoice_number
    const suffix = last.slice(prefix.length)
    const num = parseInt(suffix, 10)
    if (!Number.isNaN(num) && num >= 0) nextSeq = num + 1
  }

  return `${prefix}${String(nextSeq).padStart(4, '0')}`
}
