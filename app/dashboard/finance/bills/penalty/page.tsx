/**
 * 负数账单（invoice_type=penalty）- 金额可为负
 */

import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { EntityTable } from "@/components/crud/entity-table"
import { penaltyBillConfig } from "@/lib/crud/configs/invoices"

export default async function PenaltyBillsPage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  return (
    <DashboardLayout user={session.user || {}}>
      <EntityTable
        config={penaltyBillConfig}
        initialFilterValues={{ invoice_type: "penalty" }}
      />
    </DashboardLayout>
  )
}
