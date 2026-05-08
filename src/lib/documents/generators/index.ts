import type { ProjectDocType } from '@/types/database'
import { changeOrderForm } from './change-order-form'
import { installReminder } from './install-reminder'
import { projectWorkbook } from './project-workbook'
import { signOffSheet } from './sign-off-sheet'
import type { Generator } from './types'
import { welcomeEmail } from './welcome-email'

export const GENERATORS: Record<ProjectDocType, Generator> = {
  welcome_email: welcomeEmail,
  install_reminder: installReminder,
  sign_off_sheet: signOffSheet,
  change_order_form: changeOrderForm,
  project_workbook: projectWorkbook,
}

export type { Generator, GeneratedDoc, GeneratorContext } from './types'
