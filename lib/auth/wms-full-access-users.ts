/**
 * 指定登录名在 /api/wms/* 与 WMS 侧栏中拥有与 wms_manager 等价的访问能力。
 * 不修改数据库 role，也不影响非 WMS 模块的权限判定。
 */
const NORMALIZED_USERNAMES = new Set(['lin'])

export function isWmsFullAccessUsername(
  username: string | null | undefined
): boolean {
  if (username == null || username === '') return false
  return NORMALIZED_USERNAMES.has(username.trim().toLowerCase())
}
