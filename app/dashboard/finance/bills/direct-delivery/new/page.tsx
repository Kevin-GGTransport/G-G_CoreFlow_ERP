/**
 * 旧路由：新建直送账单已改为列表页弹窗，此处重定向至直送账单列表。
 */

import { auth } from "@/auth"
import { redirect } from "next/navigation"

export default async function NewDirectDeliveryBillPage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  redirect("/dashboard/finance/bills/direct-delivery")
}
