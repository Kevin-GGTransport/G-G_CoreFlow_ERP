"use client"

import * as React from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

export type ActualPalletsRow = {
  id: string
  actual_pallets?: number | null
  /** 已有库存行时 PUT */
  inventory_lot_id?: string | null
  /** 无库存行时 POST 创建批次 */
  order_id?: string | null
  inbound_receipt_id?: string | null
  default_warehouse_id?: string | null
}

function parsePalletInput(trimmed: string): { pallet_count: number | null } | "INVALID" {
  if (trimmed === "") {
    return { pallet_count: null }
  }
  const n = parseInt(trimmed, 10)
  if (Number.isNaN(n) || n < 0) {
    return "INVALID"
  }
  return { pallet_count: n }
}

/**
 * 订单明细列表「实际板数」：已入库则点选内联编辑；无库存行时在具备订单/仓库信息时 POST 新建批次并写 pallet_count。
 */
export function ActualPalletsInlineCell({
  row,
  onSaved,
}: {
  row: ActualPalletsRow
  onSaved: () => void
}) {
  const [editing, setEditing] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [draft, setDraft] = React.useState("")
  const inputRef = React.useRef<HTMLInputElement>(null)

  const lotId = row.inventory_lot_id
  const orderId = row.order_id
  const warehouseId = row.default_warehouse_id
  const display = row.actual_pallets

  /** 已有批次：可改；无批次：有订单+默认仓库即可新建批次（与入库管理创建逻辑一致） */
  const canMutate = Boolean(
    lotId || (orderId && warehouseId && row.id)
  )

  React.useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const startEdit = () => {
    if (!canMutate || saving) {
      if (!canMutate) {
        toast.error("无法填写实际板数：缺少订单或系统仓库信息")
      }
      return
    }
    setDraft(
      display !== null && display !== undefined ? String(Math.round(Number(display))) : ""
    )
    setEditing(true)
  }

  const save = React.useCallback(async () => {
    if (!canMutate || saving) return
    const trimmed = draft.trim()
    const parsed = parsePalletInput(trimmed)
    if (parsed === "INVALID") {
      toast.error("实际板数须为大于等于 0 的整数，或留空表示未填")
      return
    }
    // 尚无库存行：不输入数字则不创建批次（避免失焦误建）
    if (!lotId && parsed.pallet_count === null) {
      setEditing(false)
      return
    }

    const body = parsed

    setSaving(true)
    try {
      if (lotId) {
        const res = await fetch(`/api/wms/inventory-lots/${lotId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          throw new Error(typeof data.error === "string" ? data.error : "保存失败")
        }
      } else {
        const payload: Record<string, unknown> = {
          order_id: orderId,
          order_detail_id: row.id,
          warehouse_id: warehouseId,
          pallet_count: body.pallet_count,
        }
        if (row.inbound_receipt_id) {
          payload.inbound_receipt_id = row.inbound_receipt_id
        }
        const res = await fetch("/api/wms/inventory-lots", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          throw new Error(typeof data.error === "string" ? data.error : "创建库存批次失败")
        }
      }
      toast.success(lotId ? "实际板数已保存" : "已创建库存批次并保存实际板数")
      setEditing(false)
      onSaved()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存失败")
    } finally {
      setSaving(false)
    }
  }, [canMutate, draft, lotId, onSaved, orderId, row.id, row.inbound_receipt_id, saving, warehouseId])

  const displayText =
    display !== null && display !== undefined ? Math.round(Number(display)).toLocaleString() : "—"

  if (!canMutate) {
    return (
      <div className="text-muted-foreground tabular-nums" title="缺少订单或仓库信息，无法维护实际板数">
        {displayText}
      </div>
    )
  }

  if (editing) {
    return (
      <div className="min-w-[5.5rem]" onClick={(e) => e.stopPropagation()}>
        <Input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          placeholder={lotId ? "未填可清空" : "请输入板数"}
          className={cn("h-8 tabular-nums text-right", saving && "opacity-70")}
          disabled={saving}
          value={draft}
          onChange={(e) => setDraft(e.target.value.replace(/\D/g, ""))}
          onBlur={() => {
            void save()
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              ;(e.target as HTMLInputElement).blur()
            }
            if (e.key === "Escape") {
              e.preventDefault()
              setEditing(false)
              setDraft("")
            }
          }}
        />
      </div>
    )
  }

  return (
    <button
      type="button"
      className={cn(
        "w-full text-right tabular-nums rounded px-1.5 py-0.5 -mx-1.5 min-h-8",
        "hover:bg-muted/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer",
        saving && "pointer-events-none opacity-60"
      )}
      disabled={saving}
      title="点击编辑实际板数"
      onClick={(e) => {
        e.stopPropagation()
        startEdit()
      }}
    >
      {displayText}
    </button>
  )
}
