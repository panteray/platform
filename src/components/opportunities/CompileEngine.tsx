'use client'

import { useState, useCallback } from 'react'
import { GripVertical, X, Plus, Download, FileText, ChevronUp, ChevronDown } from 'lucide-react'

const PACKAGE_TYPES = [
  'Hardware Schedule', 'RFP SOW', 'Customer SOW', 'Install SOW',
  'Material List', 'Change Order', 'Site Design', 'Field Manuals', 'Programming',
] as const

const AVAILABLE_DOCUMENTS = [
  { id: 'bom', label: 'Bill of Materials', type: 'xlsx' },
  { id: 'hw_schedule', label: 'Hardware Schedule', type: 'xlsx' },
  { id: 'cable_schedule', label: 'Cable Schedule', type: 'xlsx' },
  { id: 'material_list', label: 'Material List', type: 'xlsx' },
  { id: 'sow_customer', label: 'Customer SOW', type: 'docx' },
  { id: 'sow_sub', label: 'Subcontractor SOW', type: 'docx' },
  { id: 'sow_rfp', label: 'RFP Sub (Labor Quote)', type: 'docx' },
  { id: 'field_manual', label: 'Field Installation Manual', type: 'docx' },
  { id: 'iso_compliance', label: 'ISO 62676 Compliance Report', type: 'xlsx' },
  { id: 'network_checker', label: 'Network Checker Results', type: 'pdf' },
  { id: 'canvas_snapshot', label: 'Canvas Snapshot', type: 'png' },
]

interface SelectedDoc {
  id: string
  label: string
  type: string
}

interface Props {
  oppId: string
  designId?: string
  onClose: () => void
}

export function CompileEngine({ oppId, designId, onClose }: Props) {
  const [packageType, setPackageType] = useState<string>(PACKAGE_TYPES[0])
  const [packageName, setPackageName] = useState('')
  const [selectedDocs, setSelectedDocs] = useState<SelectedDoc[]>([])
  const [compiling, setCompiling] = useState(false)

  const addDoc = (doc: typeof AVAILABLE_DOCUMENTS[number]) => {
    if (selectedDocs.some(d => d.id === doc.id)) return
    setSelectedDocs(prev => [...prev, { id: doc.id, label: doc.label, type: doc.type }])
  }

  const removeDoc = (id: string) => {
    setSelectedDocs(prev => prev.filter(d => d.id !== id))
  }

  const moveDoc = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction
    if (newIndex < 0 || newIndex >= selectedDocs.length) return
    setSelectedDocs(prev => {
      const arr = [...prev]
      const [item] = arr.splice(index, 1)
      arr.splice(newIndex, 0, item)
      return arr
    })
  }

  const handleCompile = useCallback(async () => {
    if (selectedDocs.length === 0) return
    setCompiling(true)
    try {
      // Generate a combined DOCX package using the docx library
      const { Document, Packer, Paragraph, TextRun, HeadingLevel, PageBreak, TableOfContents } = await import('docx')

      const children = [
        // Cover page
        new Paragraph({ children: [] }),
        new Paragraph({ children: [] }),
        new Paragraph({ children: [] }),
        new Paragraph({
          alignment: 'center' as never,
          children: [new TextRun({ text: packageName || `${packageType} Package`, font: 'Arial', size: 52, bold: true, color: '522F82' })],
        }),
        new Paragraph({ children: [] }),
        new Paragraph({
          alignment: 'center' as never,
          children: [new TextRun({ text: `OPP: ${oppId}`, font: 'Arial', size: 24, color: '888888' })],
        }),
        new Paragraph({
          alignment: 'center' as never,
          children: [new TextRun({ text: `Generated: ${new Date().toLocaleDateString()}`, font: 'Arial', size: 24, color: '888888' })],
        }),
        new Paragraph({
          alignment: 'center' as never,
          children: [new TextRun({ text: `${selectedDocs.length} documents included`, font: 'Arial', size: 20, color: 'AAAAAA' })],
        }),
        new Paragraph({ children: [new PageBreak()] }),

        // Table of Contents
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: 'Table of Contents', font: 'Arial' })] }),
        new TableOfContents('Table of Contents', { hyperlink: true, headingStyleRange: '1-3' }),
        new Paragraph({ children: [new PageBreak()] }),
      ]

      // Add a section heading for each selected document
      for (const doc of selectedDocs) {
        children.push(
          new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: doc.label, font: 'Arial' })] }),
          new Paragraph({ children: [new TextRun({ text: `Document type: ${doc.type.toUpperCase()}`, font: 'Arial', size: 18, color: '888888' })] }),
          new Paragraph({ children: [new TextRun({ text: 'This section references the exported document. Open the individual export for full content.', font: 'Arial', size: 20, italics: true, color: 'AAAAAA' })] }),
          new Paragraph({ children: [new PageBreak()] }),
        )
      }

      const doc = new Document({
        styles: {
          paragraphStyles: [
            { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
              run: { size: 32, bold: true, font: 'Arial' },
              paragraph: { spacing: { before: 240, after: 240 } } },
            { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
              run: { size: 28, bold: true, font: 'Arial' },
              paragraph: { spacing: { before: 180, after: 180 } } },
          ],
        },
        sections: [{
          properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
          children,
        }],
      })

      const blob = await Packer.toBlob(doc)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${packageName || packageType}_Package_V1.docx`
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      URL.revokeObjectURL(url)

      // TODO: Save to vault as a compiled package with version tracking
    } finally {
      setCompiling(false)
    }
  }, [selectedDocs, packageName, packageType, oppId])

  const available = AVAILABLE_DOCUMENTS.filter(d => !selectedDocs.some(s => s.id === d.id))

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div style={{ width: 700, maxHeight: '85vh', overflow: 'auto', background: '#fff', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#111' }}>Compile Document Package</div>
            <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>Select documents, reorder, and generate a compiled DOCX with cover page and TOC</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#999', cursor: 'pointer' }}><X size={18} /></button>
        </div>

        <div style={{ padding: 20 }}>
          {/* Package type + name */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 9, color: '#888', fontWeight: 600, marginBottom: 3, textTransform: 'uppercase' }}>Package Type</div>
              <select value={packageType} onChange={e => setPackageType(e.target.value)}
                style={{ width: '100%', padding: '6px 10px', border: '1px solid #ddd', borderRadius: 4, fontSize: 12, outline: 'none' }}>
                {PACKAGE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 9, color: '#888', fontWeight: 600, marginBottom: 3, textTransform: 'uppercase' }}>Package Name</div>
              <input value={packageName} onChange={e => setPackageName(e.target.value)} placeholder={`${packageType} Package`}
                style={{ width: '100%', padding: '6px 10px', border: '1px solid #ddd', borderRadius: 4, fontSize: 12, outline: 'none' }} />
            </div>
          </div>

          {/* Two columns: selected + available */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Selected (reorderable) */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#333', marginBottom: 8 }}>INCLUDED ({selectedDocs.length})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minHeight: 100 }}>
                {selectedDocs.map((doc, i) => (
                  <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', background: '#f8f9fa', border: '1px solid #e5e7eb', borderRadius: 4, fontSize: 11 }}>
                    <GripVertical size={12} style={{ color: '#ccc', flexShrink: 0 }} />
                    <span style={{ fontSize: 9, fontWeight: 700, color: '#999', fontFamily: 'monospace' }}>{i + 1}.</span>
                    <FileText size={12} style={{ color: '#522F82', flexShrink: 0 }} />
                    <span style={{ flex: 1, fontWeight: 500 }}>{doc.label}</span>
                    <span style={{ fontSize: 8, color: '#aaa', textTransform: 'uppercase' }}>{doc.type}</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                      <button onClick={() => moveDoc(i, -1)} disabled={i === 0} style={{ background: 'none', border: 'none', cursor: 'pointer', color: i === 0 ? '#ddd' : '#888', padding: 0, lineHeight: 1 }}><ChevronUp size={10} /></button>
                      <button onClick={() => moveDoc(i, 1)} disabled={i === selectedDocs.length - 1} style={{ background: 'none', border: 'none', cursor: 'pointer', color: i === selectedDocs.length - 1 ? '#ddd' : '#888', padding: 0, lineHeight: 1 }}><ChevronDown size={10} /></button>
                    </div>
                    <button onClick={() => removeDoc(doc.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 2 }}><X size={10} /></button>
                  </div>
                ))}
                {selectedDocs.length === 0 && <div style={{ padding: 16, textAlign: 'center', fontSize: 10, color: '#aaa', border: '1px dashed #ddd', borderRadius: 4 }}>Click documents on the right to add them</div>}
              </div>
            </div>

            {/* Available */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#333', marginBottom: 8 }}>AVAILABLE ({available.length})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {available.map(doc => (
                  <button key={doc.id} onClick={() => addDoc(doc)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', background: '#fff', border: '1px dashed #ddd', borderRadius: 4, fontSize: 11, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
                    <Plus size={12} style={{ color: '#522F82' }} />
                    <span style={{ flex: 1, fontWeight: 500, color: '#555' }}>{doc.label}</span>
                    <span style={{ fontSize: 8, color: '#aaa', textTransform: 'uppercase' }}>{doc.type}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Compile button */}
          <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={handleCompile} disabled={selectedDocs.length === 0 || compiling}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px',
                background: selectedDocs.length > 0 ? '#522F82' : '#ccc', color: '#fff',
                border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: selectedDocs.length > 0 ? 'pointer' : 'default',
                fontFamily: 'inherit', opacity: compiling ? 0.6 : 1,
              }}>
              <Download size={14} />
              {compiling ? 'Compiling...' : `Compile ${selectedDocs.length} Documents`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
