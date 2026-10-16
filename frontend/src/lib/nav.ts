import type { NavItem } from './constants'
import type { Role } from '@/types'

/** Lọc các mục điều hướng được phép hiển thị với vai trò hiện tại. */
export function visibleNavItems(nav: NavItem[], role?: Role | null): NavItem[] {
  return nav.filter((item) => !item.roles || (role ? item.roles.includes(role) : false))
}
