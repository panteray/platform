'use client'

import { Monitor, Speaker, Mic, Video, Layout, Presentation, Church, GraduationCap, Users } from 'lucide-react'
import { C } from './constants'

export interface AvRoomTemplate {
  id: string
  name: string
  description: string
  icon: React.ReactNode
  devices: Array<{
    type: string
    label: string
    category: string
    relativeX: number // 0-1 relative position
    relativeY: number
    properties: Record<string, unknown>
  }>
}

const TEMPLATES: AvRoomTemplate[] = [
  {
    id: 'conference', name: 'Conference Room', description: 'Small-medium meeting room with display, camera, and ceiling mic',
    icon: <Users size={20} />,
    devices: [
      { type: 'display', label: 'Display', category: 'av', relativeX: 0.5, relativeY: 0.1, properties: { av_type: 'display', signal_type: 'HDMI' } },
      { type: 'camera', label: 'Room Camera', category: 'av', relativeX: 0.5, relativeY: 0.15, properties: { av_type: 'camera', signal_type: 'USB' } },
      { type: 'mic', label: 'Ceiling Mic', category: 'av', relativeX: 0.5, relativeY: 0.5, properties: { av_type: 'microphone', signal_type: 'Dante' } },
      { type: 'speaker', label: 'Ceiling Speaker L', category: 'av', relativeX: 0.3, relativeY: 0.4, properties: { av_type: 'speaker', signal_type: 'Speaker Wire' } },
      { type: 'speaker', label: 'Ceiling Speaker R', category: 'av', relativeX: 0.7, relativeY: 0.4, properties: { av_type: 'speaker', signal_type: 'Speaker Wire' } },
      { type: 'control', label: 'Touch Panel', category: 'av', relativeX: 0.5, relativeY: 0.85, properties: { av_type: 'control', signal_type: 'Cat6' } },
    ],
  },
  {
    id: 'classroom', name: 'Classroom', description: 'Instructor display, projection, and audio coverage',
    icon: <GraduationCap size={20} />,
    devices: [
      { type: 'projector', label: 'Projector', category: 'av', relativeX: 0.5, relativeY: 0.3, properties: { av_type: 'projector', signal_type: 'HDBaseT' } },
      { type: 'display', label: 'Instructor Monitor', category: 'av', relativeX: 0.15, relativeY: 0.1, properties: { av_type: 'display', signal_type: 'HDMI' } },
      { type: 'mic', label: 'Wireless Mic Receiver', category: 'av', relativeX: 0.15, relativeY: 0.15, properties: { av_type: 'microphone', signal_type: 'XLR' } },
      { type: 'speaker', label: 'Speaker L', category: 'av', relativeX: 0.2, relativeY: 0.05, properties: { av_type: 'speaker', signal_type: 'Speaker Wire' } },
      { type: 'speaker', label: 'Speaker R', category: 'av', relativeX: 0.8, relativeY: 0.05, properties: { av_type: 'speaker', signal_type: 'Speaker Wire' } },
    ],
  },
  {
    id: 'auditorium', name: 'Auditorium', description: 'Large venue with distributed audio, video switching, and recording',
    icon: <Presentation size={20} />,
    devices: [
      { type: 'projector', label: 'Main Projector', category: 'av', relativeX: 0.5, relativeY: 0.15, properties: { av_type: 'projector', signal_type: 'HDBaseT' } },
      { type: 'camera', label: 'PTZ Camera', category: 'av', relativeX: 0.5, relativeY: 0.9, properties: { av_type: 'camera', signal_type: 'NDI' } },
      { type: 'switcher', label: 'Video Switcher', category: 'av', relativeX: 0.9, relativeY: 0.9, properties: { av_type: 'switcher', signal_type: 'HDMI' } },
      { type: 'speaker', label: 'Line Array L', category: 'av', relativeX: 0.2, relativeY: 0.1, properties: { av_type: 'speaker', signal_type: 'Speaker Wire' } },
      { type: 'speaker', label: 'Line Array R', category: 'av', relativeX: 0.8, relativeY: 0.1, properties: { av_type: 'speaker', signal_type: 'Speaker Wire' } },
      { type: 'mic', label: 'Podium Mic', category: 'av', relativeX: 0.5, relativeY: 0.05, properties: { av_type: 'microphone', signal_type: 'XLR' } },
      { type: 'recorder', label: 'Recorder', category: 'av', relativeX: 0.85, relativeY: 0.9, properties: { av_type: 'recorder', signal_type: 'HDMI' } },
    ],
  },
  {
    id: 'boardroom', name: 'Boardroom', description: 'Executive room with dual displays, VC, and distributed mics',
    icon: <Layout size={20} />,
    devices: [
      { type: 'display', label: 'Display L', category: 'av', relativeX: 0.35, relativeY: 0.1, properties: { av_type: 'display', signal_type: 'HDMI' } },
      { type: 'display', label: 'Display R', category: 'av', relativeX: 0.65, relativeY: 0.1, properties: { av_type: 'display', signal_type: 'HDMI' } },
      { type: 'camera', label: 'VC Camera', category: 'av', relativeX: 0.5, relativeY: 0.12, properties: { av_type: 'camera', signal_type: 'USB' } },
      { type: 'mic', label: 'Table Mic 1', category: 'av', relativeX: 0.35, relativeY: 0.5, properties: { av_type: 'microphone', signal_type: 'Dante' } },
      { type: 'mic', label: 'Table Mic 2', category: 'av', relativeX: 0.65, relativeY: 0.5, properties: { av_type: 'microphone', signal_type: 'Dante' } },
      { type: 'speaker', label: 'Ceiling Speaker 1', category: 'av', relativeX: 0.3, relativeY: 0.35, properties: { av_type: 'speaker', signal_type: 'Speaker Wire' } },
      { type: 'speaker', label: 'Ceiling Speaker 2', category: 'av', relativeX: 0.7, relativeY: 0.35, properties: { av_type: 'speaker', signal_type: 'Speaker Wire' } },
      { type: 'control', label: 'Touch Panel', category: 'av', relativeX: 0.5, relativeY: 0.7, properties: { av_type: 'control', signal_type: 'Cat6' } },
    ],
  },
  {
    id: 'training', name: 'Training Room', description: 'Flexible training space with instructor and participant views',
    icon: <Monitor size={20} />,
    devices: [
      { type: 'display', label: 'Front Display', category: 'av', relativeX: 0.5, relativeY: 0.1, properties: { av_type: 'display', signal_type: 'HDMI' } },
      { type: 'camera', label: 'Room Camera', category: 'av', relativeX: 0.5, relativeY: 0.15, properties: { av_type: 'camera', signal_type: 'USB' } },
      { type: 'mic', label: 'Ceiling Mic Array', category: 'av', relativeX: 0.5, relativeY: 0.5, properties: { av_type: 'microphone', signal_type: 'Dante' } },
      { type: 'speaker', label: 'Speaker L', category: 'av', relativeX: 0.2, relativeY: 0.1, properties: { av_type: 'speaker', signal_type: 'Speaker Wire' } },
      { type: 'speaker', label: 'Speaker R', category: 'av', relativeX: 0.8, relativeY: 0.1, properties: { av_type: 'speaker', signal_type: 'Speaker Wire' } },
    ],
  },
  {
    id: 'worship', name: 'House of Worship', description: 'Sanctuary with PA system, IMAG, and streaming',
    icon: <Church size={20} />,
    devices: [
      { type: 'projector', label: 'IMAG Projector L', category: 'av', relativeX: 0.3, relativeY: 0.15, properties: { av_type: 'projector', signal_type: 'HDBaseT' } },
      { type: 'projector', label: 'IMAG Projector R', category: 'av', relativeX: 0.7, relativeY: 0.15, properties: { av_type: 'projector', signal_type: 'HDBaseT' } },
      { type: 'camera', label: 'Stream Camera', category: 'av', relativeX: 0.5, relativeY: 0.85, properties: { av_type: 'camera', signal_type: 'NDI' } },
      { type: 'speaker', label: 'Main PA L', category: 'av', relativeX: 0.25, relativeY: 0.1, properties: { av_type: 'speaker', signal_type: 'Speaker Wire' } },
      { type: 'speaker', label: 'Main PA R', category: 'av', relativeX: 0.75, relativeY: 0.1, properties: { av_type: 'speaker', signal_type: 'Speaker Wire' } },
      { type: 'mixer', label: 'Audio Mixer', category: 'av', relativeX: 0.5, relativeY: 0.8, properties: { av_type: 'mixer', signal_type: 'Dante' } },
      { type: 'mic', label: 'Stage Mic 1', category: 'av', relativeX: 0.4, relativeY: 0.05, properties: { av_type: 'microphone', signal_type: 'XLR' } },
      { type: 'mic', label: 'Stage Mic 2', category: 'av', relativeX: 0.6, relativeY: 0.05, properties: { av_type: 'microphone', signal_type: 'XLR' } },
      { type: 'encoder', label: 'Stream Encoder', category: 'av', relativeX: 0.55, relativeY: 0.82, properties: { av_type: 'encoder', signal_type: 'HDMI' } },
    ],
  },
  {
    id: 'blank', name: 'Blank Room', description: 'Empty canvas — add your own AV devices',
    icon: <Layout size={20} />,
    devices: [],
  },
]

interface Props {
  onSelectTemplate: (template: AvRoomTemplate) => void
  onClose: () => void
}

export function AvRoomTemplateSelector({ onSelectTemplate, onClose }: Props) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
    }} onClick={onClose}>
      <div style={{
        width: 600, maxHeight: '80vh', overflow: 'auto',
        background: C.bgPanel, borderRadius: 10, border: `1px solid ${C.border}`,
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>AV Room Templates</div>
          <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>Pre-configured device layouts for common room types</div>
        </div>
        <div style={{ padding: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {TEMPLATES.map(t => (
            <button key={t.id} onClick={() => onSelectTemplate(t)}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 10, padding: 12,
                background: C.bgSurface, border: `1px solid ${C.border}`, borderRadius: 8,
                cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.border }}>
              <div style={{ color: C.accent, flexShrink: 0, marginTop: 2 }}>{t.icon}</div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{t.name}</div>
                <div style={{ fontSize: 9, color: C.textDim, marginTop: 2 }}>{t.description}</div>
                <div style={{ fontSize: 8, color: C.accent, fontWeight: 600, marginTop: 4 }}>
                  {t.devices.length} devices
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export { TEMPLATES as AV_ROOM_TEMPLATES }
