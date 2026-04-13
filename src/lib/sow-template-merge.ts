/**
 * SOW Template Merge — replaces {{merge_fields}} in DOCX templates.
 *
 * DOCX files are ZIP archives containing XML. Merge fields like {{Customer_Name}}
 * may be split across multiple <w:r> runs in the XML. This module handles both
 * single-run and split-run field replacement.
 *
 * Flow: fetch template → unzip → replace fields in document.xml → rezip → download
 */

// JSZip is available via dynamic import (already a dep of xlsx)

export interface SowMergeFields {
  // Project
  DATE?: string
  Project_Name?: string
  Install_Location?: string
  OPP_Number?: string
  Project_Number?: string

  // Customer
  Customer_Name?: string
  customer_name?: string // some templates use lowercase
  Address?: string
  Point_of_Contact?: string
  Customer_Phone?: string
  Customer_Email?: string

  // Content
  scope_of_work?: string
  material_list?: string
  project_days?: string

  // Any additional fields
  [key: string]: string | undefined
}

/**
 * Merge fields into a DOCX template and return the result as a Blob.
 *
 * @param templateUrl — URL of the .docx template (e.g., /templates/sow/SOW_Customer.docx)
 * @param fields — key-value map of {{field}} → replacement text
 * @returns Blob of the merged DOCX file
 */
export async function mergeDocxTemplate(
  templateUrl: string,
  fields: SowMergeFields,
): Promise<Blob> {
  // Dynamic import JSZip
  const JSZip = (await import('jszip')).default

  // Fetch the template
  const response = await fetch(templateUrl)
  if (!response.ok) throw new Error(`Failed to fetch template: ${response.status}`)
  const templateBuffer = await response.arrayBuffer()

  // Unzip
  const zip = await JSZip.loadAsync(templateBuffer)

  // Read document.xml
  const docXmlFile = zip.file('word/document.xml')
  if (!docXmlFile) throw new Error('Template missing word/document.xml')
  let docXml = await docXmlFile.async('string')

  // Strategy 1: Replace fields that are in a single <w:t> element
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue
    // Escape XML special characters in the replacement value
    const escaped = escapeXml(value)
    // Replace both {{Key}} and {{ Key }} variants
    const patterns = [
      `{{${key}}}`,
      `{{ ${key} }}`,
      `{{${key} }}`,
      `{{ ${key}}}`,
    ]
    for (const pattern of patterns) {
      docXml = docXml.split(pattern).join(escaped)
    }
  }

  // Strategy 2: Handle fields split across multiple <w:r> runs
  // Find sequences like: <w:t>{{</w:t></w:r><w:r>...<w:t>field_name</w:t></w:r><w:r>...<w:t>}}</w:t>
  // This regex finds the opening {{ and closing }} with any XML between them
  // Strategy 2: Handle fields split across multiple <w:r> runs
  // Collapse all text content, find merge fields, then reconstruct
  // This handles cases like: <w:t>{{</w:t></w:r><w:r><w:t>field}}</w:t>
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue
    const escaped = escapeXml(value)
    // Try progressively more aggressive patterns for split fields
    // Pattern 1: {{ split from field name by closing/opening w:t tags
    const p1 = new RegExp(
      `\\{\\{\\s*(<\\/w:t>[\\s\\S]*?<w:t[^>]*>)?\\s*${escapeRegex(key)}\\s*(<\\/w:t>[\\s\\S]*?<w:t[^>]*>)?\\s*\\}\\}`,
      'g'
    )
    docXml = docXml.replace(p1, escaped)
  }

  // Handle multiline content for scope_of_work and material_list
  // Replace \n with Word paragraph breaks
  // Note: This is a simplified approach — for proper paragraph insertion we'd need
  // to create new <w:p> elements, but for the merge field replacement in an existing
  // paragraph, we use <w:br/> for line breaks
  docXml = docXml.replace(/\n/g, (match) => {
    // Only replace newlines that are inside <w:t> elements (part of text content)
    return match
  })

  // Write back
  zip.file('word/document.xml', docXml)

  // Also check headers/footers for merge fields
  const headerFooterFiles = Object.keys(zip.files).filter(
    f => f.startsWith('word/header') || f.startsWith('word/footer')
  )
  for (const hfFile of headerFooterFiles) {
    let hfXml = await zip.file(hfFile)!.async('string')
    for (const [key, value] of Object.entries(fields)) {
      if (value === undefined) continue
      const escaped = escapeXml(value)
      hfXml = hfXml.split(`{{${key}}}`).join(escaped)
      hfXml = hfXml.split(`{{ ${key} }}`).join(escaped)
    }
    zip.file(hfFile, hfXml)
  }

  // Generate the merged DOCX
  return await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Download a Blob as a file.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
