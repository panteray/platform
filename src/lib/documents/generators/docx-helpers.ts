import { AlignmentType, HeadingLevel, Paragraph, TextRun } from 'docx'

/**
 * Convert a rendered template body (plain text, line-separated) into a list
 * of DOCX paragraphs. Lines that look like headings (ALL CAPS, 4+ chars) are
 * styled as Heading 2. Lines starting with "Subject:" become bold. Blank lines
 * become empty paragraphs (vertical spacing).
 */
export function bodyToParagraphs(body: string): Paragraph[] {
  const lines = body.split('\n')
  return lines.map((rawLine) => {
    const line = rawLine.trimEnd()
    if (line === '') return new Paragraph({ children: [new TextRun('')] })

    if (/^[A-Z][A-Z\s]{3,}$/.test(line.trim())) {
      return new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: line.trim(), bold: true })],
      })
    }

    if (line.startsWith('Subject:')) {
      return new Paragraph({
        children: [new TextRun({ text: line, bold: true })],
      })
    }

    return new Paragraph({ children: [new TextRun(line)] })
  })
}

export function signatureBlock(): Paragraph[] {
  return [
    new Paragraph({ children: [new TextRun('')] }),
    new Paragraph({ children: [new TextRun('')] }),
    new Paragraph({
      children: [new TextRun({ text: 'Customer Signature', bold: true })],
    }),
    new Paragraph({ children: [new TextRun('')] }),
    new Paragraph({ children: [new TextRun('______________________________      Date: __________________')] }),
    new Paragraph({ children: [new TextRun('Printed Name:')] }),
    new Paragraph({ children: [new TextRun('Title:')] }),
    new Paragraph({ children: [new TextRun('')] }),
    new Paragraph({
      children: [new TextRun({ text: 'Contractor Signature', bold: true })],
    }),
    new Paragraph({ children: [new TextRun('')] }),
    new Paragraph({ children: [new TextRun('______________________________      Date: __________________')] }),
    new Paragraph({ children: [new TextRun('Printed Name:')] }),
    new Paragraph({ children: [new TextRun('Title:')] }),
  ]
}

export function titleParagraph(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text, bold: true })],
  })
}
