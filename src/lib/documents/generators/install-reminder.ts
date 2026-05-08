import { Document, Packer } from 'docx'
import { renderTemplate } from '@/lib/documents/template-render'
import { bodyToParagraphs } from './docx-helpers'
import { buildVarMap, DOCX_MIME, type Generator } from './types'

export const installReminder: Generator = async (ctx) => {
  const vars = buildVarMap(ctx)
  const body = renderTemplate(ctx.template.body_md, vars)

  const doc = new Document({
    creator: ctx.orgName ?? 'Panteray',
    title: `Install Reminder — ${ctx.project.name}`,
    sections: [{ children: bodyToParagraphs(body) }],
  })

  const buffer = await Packer.toBuffer(doc)
  return { buffer, ext: 'docx', mimeType: DOCX_MIME }
}
