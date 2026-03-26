"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { IncludeArchivedOrdersToggle } from "@/components/order-visibility/include-archived-toggle"
import { parseIncludeArchived } from "@/lib/orders/order-visibility"

/** 与 GET /api/customers/:id 的 `includeArchived` 语义一致，刷新同页数据 */
export function CustomerIncludeArchivedUrlToggle() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const includeArchived = React.useMemo(
    () => parseIncludeArchived(new URLSearchParams(searchParams.toString())),
    [searchParams]
  )

  return (
    <IncludeArchivedOrdersToggle
      checked={includeArchived}
      onCheckedChange={(checked) => {
        const next = new URLSearchParams(searchParams.toString())
        if (checked) next.set("includeArchived", "true")
        else next.delete("includeArchived")
        const q = next.toString()
        router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false })
      }}
      id="customer-detail-include-archived"
    />
  )
}
