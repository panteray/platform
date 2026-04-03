import { describe, it, expect } from 'vitest'
import {
  alignMapConeRadiusFeet,
  buildDesignGeoContext,
  canvasPixelsToLatLng,
  feetPerPixelAtZoom,
  latLngToCanvasPixels,
  pixelToLatLng,
  latLngToPixel,
} from './geo-math'

describe('geo-math Phase A', () => {
  it('buildDesignGeoContext returns null without satellite or invalid scale', () => {
    expect(buildDesignGeoContext(null, 10)).toBeNull()
    expect(buildDesignGeoContext(undefined, 10)).toBeNull()
    expect(buildDesignGeoContext({ lat: 40, lng: -74 }, 0)).toBeNull()
    expect(buildDesignGeoContext({ lat: 40, lng: -74 }, -1)).toBeNull()
  })

  it('buildDesignGeoContext returns context when valid', () => {
    const c = buildDesignGeoContext({ lat: 40.7, lng: -74.0 }, 12)
    expect(c).toEqual({ centerLat: 40.7, centerLng: -74.0, scalePxPerFt: 12 })
  })

  it('canvasPixelsToLatLng / latLngToCanvasPixels roundtrip near anchor', () => {
    const ctx = buildDesignGeoContext({ lat: 33.95, lng: -118.4 }, 8)
    expect(ctx).not.toBeNull()
    const { lat: lat0, lng: lng0 } = canvasPixelsToLatLng(0, 0, ctx!)
    expect(lat0).toBeCloseTo(33.95, 5)
    expect(lng0).toBeCloseTo(-118.4, 5)

    const px = 120
    const py = -80
    const { lat, lng } = canvasPixelsToLatLng(px, py, ctx!)
    const back = latLngToCanvasPixels(lat, lng, ctx!)
    expect(back.x).toBeCloseTo(px, 4)
    expect(back.y).toBeCloseTo(py, 4)
  })

  it('pixelToLatLng matches legacy direct call', () => {
    const lat = 41.0
    const lng = -73.9
    const s = 10
    const a = pixelToLatLng(50, -30, lat, lng, s)
    const ctx = buildDesignGeoContext({ lat, lng }, s)!
    const b = canvasPixelsToLatLng(50, -30, ctx)
    expect(b.lat).toBeCloseTo(a.lat, 10)
    expect(b.lng).toBeCloseTo(a.lng, 10)
  })

  it('alignMapConeRadiusFeet is identity when map ft/px matches canvas', () => {
    const lat = 40.7
    const z = 18
    const fMap = feetPerPixelAtZoom(z, lat)
    const scalePxPerFt = 1 / fMap
    const d = 100
    expect(alignMapConeRadiusFeet(d, scalePxPerFt, z, lat)).toBeCloseTo(d, 5)
  })

  it('latLngToPixel matches legacy', () => {
    const lat = 41.0
    const lng = -73.9
    const s = 10
    const ctx = buildDesignGeoContext({ lat, lng }, s)!
    const p = latLngToPixel(41.001, -73.899, lat, lng, s)
    const q = latLngToCanvasPixels(41.001, -73.899, ctx)
    expect(q.x).toBeCloseTo(p.x, 3)
    expect(q.y).toBeCloseTo(p.y, 3)
  })
})
