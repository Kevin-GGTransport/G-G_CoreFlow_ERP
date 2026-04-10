/**
 * 拆柜账单详情 - 主行 + 账单明细（同直送账单流程）
 */

import { auth } from "@/auth"
import { redirect, notFound } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import prisma from "@/lib/prisma"
import { serializeBigInt } from "@/lib/api/helpers"
import { InvoiceBillDetailClient } from "@/components/finance/invoice-bill-detail-client"

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ContainerUnloadBillDetailPage({ params }: PageProps) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const { id } = await params
  if (!id || isNaN(Number(id))) notFound()

  const invoice = await prisma.invoices.findUnique({
    where: { invoice_id: BigInt(id) },
    include: {
      customers: { select: { id: true, code: true, name: true } },
      orders: {
        select: {
          order_id: true,
          order_number: true,
          container_type: true,
        },
      },
    },
  })

  if (!invoice || invoice.invoice_type !== "unload") notFound()

  const serialized = serializeBigInt(invoice)

  return (
    <DashboardLayout user={session.user || {}}>
      <div className="container max-w-6xl py-8">
        <InvoiceBillDetailClient
          invoiceId={id}
          invoice={serialized}
          backListHref="/dashboard/finance/bills/container-unload"
          billKindLabel="拆柜账单"
        />
      </div>
    </DashboardLayout>
  )
}
