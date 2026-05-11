import * as XLSX from 'xlsx'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildVarMap, XLSX_MIME, type Generator } from './types'

export const projectWorkbook: Generator = async (ctx) => {
  const vars = buildVarMap(ctx)
  const admin = createAdminClient()

  // Sheet 1: Project Info
  const infoSheet = XLSX.utils.json_to_sheet(
    [
      { Field: 'Project Name', Value: vars.project_name },
      { Field: 'Project Number', Value: vars.project_number },
      { Field: 'Customer', Value: vars.customer_name },
      { Field: 'Site Address', Value: vars.site_address },
      { Field: 'Project Manager', Value: vars.pm_name },
      { Field: 'Status', Value: ctx.project.status },
      { Field: 'Start Date', Value: ctx.project.start_date ?? '' },
      { Field: 'Target End Date', Value: ctx.project.target_end_date ?? '' },
      { Field: 'Budget', Value: ctx.project.budget_amount != null ? String(ctx.project.budget_amount) : '' },
      { Field: 'Generated', Value: vars.today },
    ],
    { header: ['Field', 'Value'] },
  )

  // Sheet 2: Tasks
  const { data: tasks } = await admin
    .from('project_tasks')
    .select('title, status, priority, assignee_id, due_date, completed_at')
    .eq('project_id', ctx.project.id)
    .order('sort_order', { ascending: true })

  const tasksSheet = XLSX.utils.json_to_sheet(
    (tasks ?? []).map((t) => ({
      Title: t.title ?? '',
      Status: t.status ?? '',
      Priority: t.priority ?? '',
      Assignee: t.assignee_id ?? '',
      'Due Date': t.due_date ?? '',
      Completed: t.completed_at ?? '',
    })),
    { header: ['Title', 'Status', 'Priority', 'Assignee', 'Due Date', 'Completed'] },
  )

  // Sheet 3: Milestones
  const { data: milestones } = await admin
    .from('project_milestones')
    .select('title, target_date, completed_at, sort_order')
    .eq('project_id', ctx.project.id)
    .order('sort_order', { ascending: true })

  const milestonesSheet = XLSX.utils.json_to_sheet(
    (milestones ?? []).map((m) => ({
      Milestone: m.title ?? '',
      'Target Date': m.target_date ?? '',
      Completed: m.completed_at ?? '',
    })),
    { header: ['Milestone', 'Target Date', 'Completed'] },
  )

  // Sheet 4: Change Orders
  const { data: changeOrders } = await admin
    .from('change_orders')
    .select('co_number, title, status, cost_impact, schedule_impact_days, created_at')
    .eq('project_id', ctx.project.id)
    .order('created_at', { ascending: true })

  const coSheet = XLSX.utils.json_to_sheet(
    (changeOrders ?? []).map((c) => ({
      'CO Number': c.co_number ?? '',
      Title: c.title ?? '',
      Status: c.status ?? '',
      'Cost Impact': c.cost_impact != null ? String(c.cost_impact) : '',
      'Schedule Impact (days)': c.schedule_impact_days != null ? String(c.schedule_impact_days) : '',
      Created: c.created_at ?? '',
    })),
    { header: ['CO Number', 'Title', 'Status', 'Cost Impact', 'Schedule Impact (days)', 'Created'] },
  )

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, infoSheet, 'Project Info')
  XLSX.utils.book_append_sheet(wb, tasksSheet, 'Tasks')
  XLSX.utils.book_append_sheet(wb, milestonesSheet, 'Milestones')
  XLSX.utils.book_append_sheet(wb, coSheet, 'Change Orders')

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  return { buffer, ext: 'xlsx', mimeType: XLSX_MIME }
}
