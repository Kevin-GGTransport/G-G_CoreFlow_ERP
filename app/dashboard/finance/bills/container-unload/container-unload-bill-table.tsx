"use client"

import React from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { EntityTable } from "@/components/crud/entity-table"
import { containerUnloadBillConfig } from "@/lib/crud/configs/invoices"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"

export function ContainerUnloadBillTable() {
  const router = useRouter()

  const customActions = React.useMemo(
    () => ({
      onView: (row: { invoice_id?: string | number }) => {
        const id = row.invoice_id != null ? String(row.invoice_id) : null
        if (id) router.push(`/dashboard/finance/bills/container-unload/${id}`)
      },
    }),
    [router]
  )

  return (
    <EntityTable
      config={containerUnloadBillConfig}
      initialFilterValues={{ invoice_type: "unload" }}
      customActions={customActions}
      customToolbarButtons={
        <Button asChild variant="default" size="sm" className="bg-gradient-to-r from-blue-600 to-indigo-600">
          <Link href="/dashboard/finance/bills/container-unload/new">
            <Plus className="mr-2 h-5 w-5" />
            新建拆柜账单
          </Link>
        </Button>
      }
    />
  )
}
