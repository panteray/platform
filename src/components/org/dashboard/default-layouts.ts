import { UserRole } from '@/types/enums'

export interface LayoutItem {
  i: string      // widget id
  x: number
  y: number
  w: number
  h: number
  minW?: number
  minH?: number
}

/* 12-col grid. KPI default w=3 h=2. Composite list w=6 h=5. */

function row(ids: string[], y: number): LayoutItem[] {
  return ids.map((id, idx) => ({ i: id, x: (idx % 4) * 3, y: y + Math.floor(idx / 4) * 2, w: 3, h: 2, minW: 2, minH: 2 }))
}

const EXECUTIVE: LayoutItem[] = [
  ...row(['open_pipeline', 'won_month', 'lost_month', 'win_rate'], 0),
  ...row(['active_projects', 'at_risk_projects', 'open_tickets', 'sla_breached'], 2),
  ...row(['expired_licenses', 'expired_certs', 'subs_on_hold'], 4),
  ...row(['outstanding_ar', 'mrr'], 6),
]

const ORG_ADMIN: LayoutItem[] = [
  ...row(['active_users', 'total_opps', 'total_projects', 'total_customers'], 0),
  ...row(['manufacturers', 'subcontractors', 'distributors'], 2),
  { i: 'notifications', x: 0, y: 4, w: 6, h: 5, minW: 4, minH: 4 },
  { i: 'recent_customers', x: 6, y: 4, w: 6, h: 5, minW: 4, minH: 4 },
]

const MANAGER: LayoutItem[] = [
  ...row(['total_customers', 'manufacturers', 'subcontractors', 'distributors'], 0),
  ...row(['total_opps', 'opps_in_progress', 'opps_submitted', 'opps_won'], 2),
  ...row(['projects_in_progress', 'projects_closed', 'opps_waiting', 'change_orders'], 4),
  ...row(['action_items', 'calendar', 'kpis'], 6),
]

const SALES: LayoutItem[] = [
  ...row(['total_opps', 'total_customers', 'opps_submitted', 'opps_won'], 0),
  ...row(['opps_waiting', 'action_items', 'calendar'], 2),
]

const PRESALES: LayoutItem[] = [
  ...row(['total_opps', 'opps_waiting', 'opps_won', 'designs_in_progress'], 0),
  ...row(['change_orders', 'action_items', 'calendar'], 2),
]

const PM: LayoutItem[] = [
  ...row(['projects_in_progress', 'project_progress', 'opps_waiting', 'change_orders'], 0),
  ...row(['action_items', 'calendar', 'sub_locations', 'installer_locations'], 2),
]

const FIELD: LayoutItem[] = [
  ...row(['today_view', 'upcoming', 'calendar', 'action_items'], 0),
  ...row(['project_progress'], 2),
]

const FIELD_LEAD: LayoutItem[] = [
  ...row(['today_view', 'upcoming', 'calendar', 'action_items'], 0),
  ...row(['field_tech_locations', 'project_progress'], 2),
]

export const DEFAULT_LAYOUTS: Record<UserRole, LayoutItem[]> = {
  [UserRole.GLOBAL_ADMIN]: EXECUTIVE,
  [UserRole.GLOBAL_MANAGER]: EXECUTIVE,
  [UserRole.ORG_ADMIN]: EXECUTIVE,
  [UserRole.ORG_MANAGER]: EXECUTIVE,
  [UserRole.MANAGER]: MANAGER,
  [UserRole.OPERATIONS]: MANAGER,
  [UserRole.SALES_ISR]: SALES,
  [UserRole.SALES_OSR]: SALES,
  [UserRole.PRESALES]: PRESALES,
  [UserRole.PROJECT_MANAGER]: PM,
  [UserRole.TECH_SUP]: MANAGER,
  [UserRole.LEAD]: FIELD_LEAD,
  [UserRole.FIELD_TECH]: FIELD,
  [UserRole.SUBCONTRACTOR]: FIELD,
  [UserRole.CUSTOMER]: FIELD,
}

export const FALLBACK_LAYOUT: LayoutItem[] = ORG_ADMIN

export function layoutForRole(role: UserRole | null | undefined): LayoutItem[] {
  if (!role) return FALLBACK_LAYOUT
  return DEFAULT_LAYOUTS[role] ?? FALLBACK_LAYOUT
}
