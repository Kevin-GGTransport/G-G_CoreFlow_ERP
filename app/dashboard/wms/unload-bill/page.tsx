import { redirect } from 'next/navigation';

/** 卸货工人账单已迁至业务计费，保留旧链接兼容 */
export default function UnloadBillRedirectPage() {
  redirect('/dashboard/finance/bills/unload');
}
