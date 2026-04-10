/**
 * 新建拆柜账单 - 第一步：填写主行，提交后跳转详情页添加明细
 */

import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { NewContainerUnloadBillForm } from "../new-container-unload-form"

export default async function NewContainerUnloadBillPage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  return (
    <DashboardLayout user={session.user || {}}>
      <div className="container max-w-2xl py-8">
        <h1 className="text-2xl font-semibold mb-6">新建拆柜账单</h1>
        <NewContainerUnloadBillForm />
      </div>
    </DashboardLayout>
  )
}
