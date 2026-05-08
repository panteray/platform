import type { ProjectDocType } from '@/types/database'

interface DefaultTemplate {
  name: string
  body_md: string
  variables: Array<{ key: string; label: string; default?: string }>
}

const COMMON_VARS: DefaultTemplate['variables'] = [
  { key: 'project_name', label: 'Project Name' },
  { key: 'project_number', label: 'Project Number' },
  { key: 'customer_name', label: 'Customer Name' },
  { key: 'site_address', label: 'Site Address' },
  { key: 'pm_name', label: 'Project Manager' },
  { key: 'org_name', label: 'Your Company' },
  { key: 'today', label: "Today's Date" },
]

export const DEFAULT_TEMPLATES: Record<ProjectDocType, DefaultTemplate> = {
  welcome_email: {
    name: 'Welcome Email',
    variables: COMMON_VARS,
    body_md: [
      'Subject: Welcome to your {{project_name}} project',
      '',
      'Hi {{customer_name}},',
      '',
      'Thank you for choosing {{org_name}} for your {{project_name}} installation. We are excited to get started.',
      '',
      'Project number: {{project_number}}',
      'Site: {{site_address}}',
      'Project manager: {{pm_name}}',
      '',
      'Over the next several weeks our team will be in regular contact to schedule site visits, confirm equipment delivery, and walk you through milestones. If you have any questions, please reply directly to this email.',
      '',
      'Welcome aboard,',
      'The {{org_name}} Team',
    ].join('\n'),
  },
  project_workbook: {
    name: 'Project Workbook',
    variables: COMMON_VARS,
    body_md: '',
  },
  install_reminder: {
    name: 'Install Reminder',
    variables: COMMON_VARS,
    body_md: [
      'Subject: Upcoming installation — {{project_name}}',
      '',
      'Hi {{customer_name}},',
      '',
      'This is a friendly reminder that your installation for {{project_name}} ({{project_number}}) is scheduled to begin shortly at {{site_address}}.',
      '',
      'Before our crew arrives, please confirm the following:',
      '  • Site access and parking arrangements',
      '  • Power and network availability at install locations',
      '  • Single point of contact on site for the duration of the install',
      '',
      'Your project manager, {{pm_name}}, will follow up with the exact arrival window.',
      '',
      'Thanks,',
      'The {{org_name}} Team',
    ].join('\n'),
  },
  sign_off_sheet: {
    name: 'Sign Off Sheet',
    variables: COMMON_VARS,
    body_md: [
      'PROJECT SIGN OFF',
      '',
      'Project: {{project_name}}',
      'Project Number: {{project_number}}',
      'Customer: {{customer_name}}',
      'Site: {{site_address}}',
      'Date: {{today}}',
      '',
      'The undersigned acknowledges that the work described above has been completed in accordance with the agreed scope of work, system commissioning has been performed, and the system has been demonstrated to operate as designed.',
      '',
      'Any outstanding punch list items have been documented separately and do not affect operational acceptance of the system.',
    ].join('\n'),
  },
  change_order_form: {
    name: 'Change Order Form',
    variables: [
      ...COMMON_VARS,
      { key: 'co_number', label: 'CO Number' },
      { key: 'co_description', label: 'Description of Change' },
      { key: 'co_reason', label: 'Reason for Change' },
      { key: 'co_amount', label: 'Total Amount' },
    ],
    body_md: [
      'CHANGE ORDER',
      '',
      'Project: {{project_name}}',
      'Project Number: {{project_number}}',
      'Customer: {{customer_name}}',
      'Change Order Number: {{co_number}}',
      'Date: {{today}}',
      '',
      'Description of Change:',
      '{{co_description}}',
      '',
      'Reason for Change:',
      '{{co_reason}}',
      '',
      'Total Amount: {{co_amount}}',
      '',
      'This change order, when signed by both parties, becomes part of the original contract. All other terms and conditions of the original contract remain unchanged.',
    ].join('\n'),
  },
}
