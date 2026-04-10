"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { CopyPlus, Loader2 } from "lucide-react"

type CloneDefaultFeesButtonProps = {
  onSuccess?: () => void
}

export function CloneDefaultFeesButton({ onSuccess }: CloneDefaultFeesButtonProps) {
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)

  const runClone = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/finance/fees/clone-default-to-customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || "操作失败")
      }
      toast.success(data.message || `已新增 ${data.created ?? 0} 条`)
      setOpen(false)
      onSuccess?.()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "操作失败")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9 rounded-lg"
        onClick={() => setOpen(true)}
      >
        <CopyPlus className="mr-2 h-4 w-4" />
        按客户复制默认费用
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>按客户复制默认费用</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2 text-left text-sm text-muted-foreground">
                <p>
                  将当前所有<strong className="text-foreground">归属范围为「所有客户」</strong>且
                  <strong className="text-foreground">未绑定客户</strong>
                  的费用行作为模板；对系统中<strong className="text-foreground">每一个客户</strong>
                  生成一份相同的费用行：
                </p>
                <ul className="list-disc pl-5">
                  <li>新行归属范围为「指定客户」，并绑定对应客户；</li>
                  <li>
                    若该客户<strong className="text-foreground">已从同一条默认模板行复制过</strong>
                    （系统会记录来源），则<strong className="text-foreground">跳过</strong>。
                    默认表里多条「费用编码 + 柜型」相同也会<strong className="text-foreground">逐行各复制一条</strong>。
                  </li>
                </ul>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              取消
            </Button>
            <Button type="button" onClick={runClone} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              确认生成
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
