'use client'

import {
  DollarSign, TrendingUp, TrendingDown, Target, FolderKanban, AlertTriangle,
  TicketCheck, ShieldAlert, Award, Users, Receipt, Repeat,
  Briefcase, Send, Trophy, Clock, ListChecks, CalendarDays, Building2, Wrench,
  FolderCheck, FileDiff, BarChart3, PenTool, CalendarClock, MapPin, HardHat, Activity,
} from 'lucide-react'
import {
  makeExecWidget, makeCountWidget, makeStaticWidget, execPicks,
  NotificationsWidget, RecentCustomersWidget,
} from './widget-data'

export interface WidgetDef {
  id: string
  label: string
  render: React.ComponentType<{ brandColor: string | null; divisionFilter: string; accentIndex?: number }>
  defaultSize: { w: number; h: number; minW?: number; minH?: number }
}

/* 12-col grid. KPI cards: w=3 h=2. Composite (feeds/lists): w=6 h=5. */
const KPI_SIZE = { w: 3, h: 2, minW: 2, minH: 2 }
const LIST_SIZE = { w: 6, h: 5, minW: 4, minH: 4 }

export const WIDGETS: Record<string, WidgetDef> = {
  // Exec KPIs
  open_pipeline:     { id: 'open_pipeline', label: 'Open Pipeline', render: makeExecWidget('Open Pipeline', DollarSign, execPicks.open_pipeline), defaultSize: KPI_SIZE },
  won_month:         { id: 'won_month', label: 'Won This Month', render: makeExecWidget('Won This Month', TrendingUp, execPicks.won_month), defaultSize: KPI_SIZE },
  lost_month:        { id: 'lost_month', label: 'Lost This Month', render: makeExecWidget('Lost This Month', TrendingDown, execPicks.lost_month), defaultSize: KPI_SIZE },
  win_rate:          { id: 'win_rate', label: 'Win Rate', render: makeExecWidget('Win Rate', Target, execPicks.win_rate), defaultSize: KPI_SIZE },
  active_projects:   { id: 'active_projects', label: 'Active Projects', render: makeExecWidget('Active Projects', FolderKanban, execPicks.active_projects), defaultSize: KPI_SIZE },
  at_risk_projects:  { id: 'at_risk_projects', label: 'At Risk Projects', render: makeExecWidget('At Risk Projects', AlertTriangle, execPicks.at_risk_projects), defaultSize: KPI_SIZE },
  open_tickets:      { id: 'open_tickets', label: 'Open Tickets', render: makeExecWidget('Open Tickets', TicketCheck, execPicks.open_tickets), defaultSize: KPI_SIZE },
  sla_breached:      { id: 'sla_breached', label: 'SLA Breaches', render: makeExecWidget('SLA Breaches', ShieldAlert, execPicks.sla_breached), defaultSize: KPI_SIZE },
  expired_licenses:  { id: 'expired_licenses', label: 'Expired Licenses', render: makeExecWidget('Expired Licenses', Award, execPicks.expired_licenses), defaultSize: KPI_SIZE },
  expired_certs:     { id: 'expired_certs', label: 'Expired Certs', render: makeExecWidget('Expired Certs', ShieldAlert, execPicks.expired_certs), defaultSize: KPI_SIZE },
  subs_on_hold:      { id: 'subs_on_hold', label: 'Subs on Hold', render: makeExecWidget('Subs on Hold', Users, execPicks.subs_on_hold), defaultSize: KPI_SIZE },
  outstanding_ar:    { id: 'outstanding_ar', label: 'Outstanding AR', render: makeExecWidget('Outstanding AR', Receipt, execPicks.outstanding_ar), defaultSize: KPI_SIZE },
  mrr:               { id: 'mrr', label: 'Monthly Recurring Revenue', render: makeExecWidget('Monthly Recurring Revenue', Repeat, execPicks.mrr), defaultSize: KPI_SIZE },

  // Count widgets (live Supabase counts)
  active_users:      { id: 'active_users', label: 'Active Users', render: makeCountWidget('Active Users', Users, 'Team members in your org', 'users'), defaultSize: KPI_SIZE },
  total_opps:        { id: 'total_opps', label: 'Opportunities', render: makeCountWidget('Opportunities', Briefcase, 'Total pipeline opportunities', 'opportunities'), defaultSize: KPI_SIZE },
  total_projects:    { id: 'total_projects', label: 'Projects', render: makeCountWidget('Projects', FolderKanban, 'Active project engagements', 'projects'), defaultSize: KPI_SIZE },
  total_customers:   { id: 'total_customers', label: 'Customers', render: makeCountWidget('Customers', Building2, 'Customer accounts', 'customers'), defaultSize: KPI_SIZE },
  manufacturers:     { id: 'manufacturers', label: 'Manufacturers', render: makeCountWidget('Manufacturers', Building2, 'Manufacturer relationships', 'manufacturers'), defaultSize: KPI_SIZE },
  subcontractors:    { id: 'subcontractors', label: 'Subcontractors', render: makeCountWidget('Subcontractors', Wrench, 'Subcontractor partners', 'subcontractors'), defaultSize: KPI_SIZE },
  distributors:      { id: 'distributors', label: 'Distributors', render: makeCountWidget('Distributors', Building2, 'Distributor accounts', 'distributors'), defaultSize: KPI_SIZE },

  // Static placeholder widgets (empty state until data wired)
  opps_in_progress:  { id: 'opps_in_progress', label: 'OPPs In Progress', render: makeStaticWidget('OPPs In Progress', Briefcase, 'Opportunities currently being worked', 'No active opportunities'), defaultSize: KPI_SIZE },
  opps_submitted:    { id: 'opps_submitted', label: 'OPPs Submitted', render: makeStaticWidget('OPPs Submitted', Send, 'Proposals awaiting response', 'No submitted opportunities'), defaultSize: KPI_SIZE },
  opps_won:          { id: 'opps_won', label: 'OPPs Won', render: makeStaticWidget('OPPs Won', Trophy, 'By month and year', 'No won opportunities yet'), defaultSize: KPI_SIZE },
  opps_waiting:      { id: 'opps_waiting', label: 'OPPs Waiting On', render: makeStaticWidget('OPPs Waiting On', Clock, 'Items awaiting external action', 'Nothing pending'), defaultSize: KPI_SIZE },
  projects_in_progress: { id: 'projects_in_progress', label: 'Projects In Progress', render: makeStaticWidget('Projects In Progress', FolderKanban, 'Currently running projects', 'No active projects'), defaultSize: KPI_SIZE },
  projects_closed:   { id: 'projects_closed', label: 'Projects Closed', render: makeStaticWidget('Projects Closed', FolderCheck, 'Per year / month / user', 'No closed projects yet'), defaultSize: KPI_SIZE },
  project_progress:  { id: 'project_progress', label: 'Project Progress', render: makeStaticWidget('Project Progress', BarChart3, 'Completion status by project', 'No project data yet'), defaultSize: KPI_SIZE },
  change_orders:     { id: 'change_orders', label: 'Change Orders', render: makeStaticWidget('Change Orders', FileDiff, 'Active change orders', 'No change orders'), defaultSize: KPI_SIZE },
  action_items:      { id: 'action_items', label: 'Action Items', render: makeStaticWidget('Action Items', ListChecks, 'Tasks requiring your attention', 'No action items'), defaultSize: KPI_SIZE },
  calendar:          { id: 'calendar', label: 'Calendar', render: makeStaticWidget('Calendar', CalendarDays, 'Meetings and milestones', 'No upcoming events'), defaultSize: KPI_SIZE },
  kpis:              { id: 'kpis', label: 'KPIs', render: makeStaticWidget('KPIs', BarChart3, 'Per-user performance metrics', 'No KPI data yet'), defaultSize: KPI_SIZE },
  designs_in_progress: { id: 'designs_in_progress', label: 'Designs In Progress', render: makeStaticWidget('Designs In Progress', PenTool, 'System designs in work', 'No active designs'), defaultSize: KPI_SIZE },
  today_view:        { id: 'today_view', label: 'Today View', render: makeStaticWidget('Today View', CalendarDays, 'What is scheduled for today', 'Nothing scheduled today'), defaultSize: KPI_SIZE },
  upcoming:          { id: 'upcoming', label: 'Upcoming Assignments', render: makeStaticWidget('Upcoming Assignments', CalendarClock, 'PN, date, location, customer', 'No upcoming assignments'), defaultSize: KPI_SIZE },
  field_tech_locations: { id: 'field_tech_locations', label: 'Field Tech Locations', render: makeStaticWidget('Field Tech Locations', MapPin, 'PN / Location per field tech', 'No active tech assignments'), defaultSize: KPI_SIZE },
  sub_locations:     { id: 'sub_locations', label: 'Sub Locations', render: makeStaticWidget('Sub Locations', MapPin, 'PN / Location per subcontractor', 'No active sub assignments'), defaultSize: KPI_SIZE },
  installer_locations: { id: 'installer_locations', label: 'Installer Locations', render: makeStaticWidget('Installer Locations', HardHat, 'PN / Location per installer', 'No active installer assignments'), defaultSize: KPI_SIZE },

  // Composite widgets
  notifications:     { id: 'notifications', label: 'Recent Notifications', render: () => <NotificationsWidget />, defaultSize: LIST_SIZE },
  recent_customers:  { id: 'recent_customers', label: 'Recent Customers', render: () => <RecentCustomersWidget />, defaultSize: LIST_SIZE },
}

export const WIDGET_IDS = Object.keys(WIDGETS)

// Silence unused icon import lint (kept for future wiring):
void Activity
