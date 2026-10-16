import {
  BarChart3,
  Bell,
  ClipboardCheck,
  FileBadge,
  FileCog,
  FileSignature,
  FileText,
  FolderTree,
  History,
  Home,
  LayoutDashboard,
  Library,
  ScrollText,
  ShieldCheck,
  UserCircle,
  UserCog,
  Users,
  Workflow,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/** Ánh xạ tên icon trong cấu hình điều hướng sang component lucide. */
const NAV_ICONS: Record<string, LucideIcon> = {
  Home,
  Library,
  ShieldCheck,
  FileText,
  Bell,
  UserCircle,
  LayoutDashboard,
  ClipboardCheck,
  History,
  UserCog,
  FileCog,
  Workflow,
  FileSignature,
  FileBadge,
  BarChart3,
  Users,
  FolderTree,
  ScrollText,
}

export function navIcon(name: string): LucideIcon {
  return NAV_ICONS[name] ?? FileText
}
