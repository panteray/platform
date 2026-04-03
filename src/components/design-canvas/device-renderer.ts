/**
 * Device Renderer — Device icon creation and management for Fabric.js canvas.
 *
 * Handles:
 * - Loading PNG/SVG device icons
 * - Creating Fabric objects with proper tags
 * - Selection ring rendering
 * - Category-based icon mapping
 */

import { CATEGORY_TO_ICON, DEVICE_SVG_STRINGS } from './icons'
import { C } from './constants'

type FabricModule = typeof import('fabric')
type FabricObject = import('fabric').FabricObject

// Camera type → PNG image mapping (Hanwha icons)
const CAT_TO_PNG: Record<string, string> = {
  cctv: '/icons/cctv/dome.png',
  dome: '/icons/cctv/dome.png',
  bullet: '/icons/cctv/bullet.png',
  ptz: '/icons/cctv/PTZ.png',
  fisheye: '/icons/cctv/fisheye.png',
  multisensor_quad: '/icons/cctv/multisensor.png',
  multisensor_dual: '/icons/cctv/dualsensor.png',
  turret: '/icons/cctv/turret.png',
  box: '/icons/cctv/box.png',
  covert: '/icons/cctv/covert.png',
  corner: '/icons/cctv/corner.png',
  mini_dome: '/icons/cctv/mini_dome.png',
}

const ICON_SIZE = 28 // px on canvas

/** Camera categories that have FOV cones */
export const CAM_CATS = [
  'cctv', 'dome', 'bullet', 'turret', 'ptz', 'fisheye',
  'multisensor_quad', 'multisensor_dual',
]

/**
 * Create a Fabric object for a device.
 * Tries PNG first (for camera types), falls back to SVG, then to a simple circle.
 */
export async function createDeviceObject(
  fm: FabricModule,
  category: string,
  posX: number,
  posY: number,
  rotation: number,
  isSelected: boolean,
  deviceId: string,
  label?: string,
): Promise<FabricObject> {
  let iconObj: FabricObject

  const pngUrl = CAT_TO_PNG[category]

  if (pngUrl) {
    try {
      const img = await fm.FabricImage.fromURL(pngUrl, { crossOrigin: 'anonymous' })
      const scale = ICON_SIZE / Math.max(img.width || 64, img.height || 64)
      img.set({
        left: 0, top: 0,
        originX: 'center', originY: 'center',
        scaleX: scale, scaleY: scale,
      })
      iconObj = img
    } catch {
      iconObj = await createSvgFallback(fm, category, 0, 0, 0)
    }
  } else {
    iconObj = await createSvgFallback(fm, category, 0, 0, 0)
  }

  // Label text below icon
  const labelText = label ? label.split(' — ')[0] : '' // Show short label (e.g. "CAM-001")
  const textObj = new fm.FabricText(labelText, {
    left: 0, top: ICON_SIZE / 2 + 4,
    originX: 'center', originY: 'top',
    fontSize: 9, fill: '#1E293B',
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
    fontWeight: '600',
    textAlign: 'center',
  })

  // Group icon + label
  const group = new fm.Group(labelText ? [iconObj, textObj] : [iconObj], {
    left: posX, top: posY,
    originX: 'center', originY: 'center',
    angle: rotation,
    hasControls: false, hasBorders: false, lockRotation: true,
    selectable: true, evented: true,
    hoverCursor: 'move', moveCursor: 'move',
    subTargetCheck: false,
  })

  // Tag for event handling
  const rec = group as unknown as Record<string, unknown>
  rec.__devId = deviceId

  // Selection ring
  if (isSelected) {
    group.set({
      stroke: '#7c5cfc',
      strokeWidth: 2,
      padding: 4,
    } as Record<string, unknown>)
  }

  return group
}

async function createSvgFallback(
  fm: FabricModule,
  category: string,
  posX: number,
  posY: number,
  _rotation?: number,
): Promise<FabricObject> {
  const iconKey = CATEGORY_TO_ICON[category] || 'generic'
  const svgStr = DEVICE_SVG_STRINGS[iconKey]

  if (svgStr) {
    try {
      const res = await fm.loadSVGFromString(svgStr)
      const filtered = res.objects.filter(Boolean) as FabricObject[]
      const ico = fm.util.groupSVGElements(filtered, res.options)
      ico.set({
        left: posX, top: posY,
        originX: 'center', originY: 'center',
        scaleX: 0.4, scaleY: 0.4,
      })
      return ico
    } catch {
      // Fall through to circle
    }
  }

  // Ultimate fallback: simple circle
  return new fm.Circle({
    left: posX, top: posY,
    radius: 10, fill: '#522F82',
    originX: 'center', originY: 'center',
  })
}

/**
 * Create MDF/IDF rack icon.
 */
export async function createMdfObject(
  fm: FabricModule,
  name: string,
  posX: number,
  posY: number,
  color: string,
  mdfId: string,
): Promise<FabricObject> {
  const rackSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><rect x="6" y="4" width="20" height="24" rx="2" fill="${color}" opacity="0.9"/><rect x="9" y="8" width="14" height="3" rx="1" fill="#fff" opacity="0.6"/><rect x="9" y="13" width="14" height="3" rx="1" fill="#fff" opacity="0.6"/><rect x="9" y="18" width="14" height="3" rx="1" fill="#fff" opacity="0.6"/><circle cx="20" cy="9.5" r="1" fill="#22c55e"/><circle cx="20" cy="14.5" r="1" fill="#22c55e"/><circle cx="20" cy="19.5" r="1" fill="#22c55e"/></svg>`

  try {
    const res = await fm.loadSVGFromString(rackSvg)
    const filtered = res.objects.filter(Boolean) as FabricObject[]
    const ico = fm.util.groupSVGElements(filtered, res.options)
    const lbl = new fm.FabricText(name || 'MDF', {
      left: 0, top: 20, fontSize: 10, fill: C.text,
      fontFamily: "'Inter', 'Segoe UI', sans-serif", originX: 'center', originY: 'top',
      fontWeight: '600',
    })
    const group = new fm.Group([ico, lbl], {
      left: posX, top: posY,
      originX: 'center', originY: 'center',
      hasControls: false, hasBorders: false,
      selectable: true, evented: true,
      hoverCursor: 'move', moveCursor: 'move',
    })
    const rec = group as unknown as Record<string, unknown>
    rec.__mdfId = mdfId
    return group
  } catch {
    const circle = new fm.Circle({
      left: posX, top: posY,
      radius: 12, fill: color,
      originX: 'center', originY: 'center',
      hasControls: false, hasBorders: false,
      selectable: true, evented: true,
      hoverCursor: 'move', moveCursor: 'move',
    })
    const rec = circle as unknown as Record<string, unknown>
    rec.__mdfId = mdfId
    return circle
  }
}
