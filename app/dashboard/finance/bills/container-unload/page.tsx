/**
 * 拆柜账单（发票 invoice_type=unload）- 主行+明细，流程同直送账单
 */

import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { ContainerUnloadBillTable } from "./container-unload-bill-table"

export default async function ContainerUnloadBillsPage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  return (
    <DashboardLayout user={session.user || {}}>
      <ContainerUnloadBillTable />
    </DashboardLayout>
  )
}
