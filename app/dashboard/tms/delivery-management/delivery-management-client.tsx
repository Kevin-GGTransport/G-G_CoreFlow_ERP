"use client"

import * as React from "react"
import { EntityTable } from "@/components/crud/entity-table"
import { deliveryManagementConfig } from "@/lib/crud/configs/delivery-management"
import { IncludeArchivedOrdersToggle } from "@/components/order-visibility/include-archived-toggle"

const EMPTY_EXTRA_LIST_PARAMS: Record<string, string> = {}

export function DeliveryManagementClient() {
  const [includeArchived, setIncludeArchived] = React.useState(false)
  const extraListParams = React.useMemo(
    () => (includeArchived ? { includeArchived: "true" } : EMPTY_EXTRA_LIST_PARAMS),
    [includeArchived]
  )
  const customToolbarButtons = React.useMemo(
    () => (
      <IncludeArchivedOrdersToggle
        checked={includeArchived}
        onCheckedChange={setIncludeArchived}
        id="delivery-management-include-archived"
      />
    ),
    [includeArchived]
  )

  return (
    <EntityTable
      config={deliveryManagementConfig}
      extraListParams={extraListParams}
      customToolbarButtons={customToolbarButtons}
    />
  )
}
