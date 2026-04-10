/**
 * 直送账单 - 主行+明细；新建主行通过列表弹窗按柜号创建，明细在详情页维护。
 */

import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { DirectDeliveryBillTable } from "./direct-delivery-bill-table"

export default async function DirectDeliveryBillsPage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  return (
    <DashboardLayout user={session.user || {}}>
      <DirectDeliveryBillTable />
    </DashboardLayout>
  )
}
