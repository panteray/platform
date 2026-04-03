# Design Canvas Roadmap (IPVM / Hanwha DesignPro / Axis Site Designer parity)

Duplicate of the **Design Canvas Roadmap** section in `CLAUDE.md`. **Keep both files in sync** when editing.

**Suggested order:** Phase 0 → A → B (optional) → C (can parallel early Phase 0) → D (product-dependent) → E (ongoing).

---

## Phase 0 — Basemap & install address

**Goal:** Canvas defaults to satellite at the job address; optional floor plan on top; pan/zoom feels interactive (canvas-driven sync with `SatelliteMap`).

| Step | Work |
|------|------|
| **0.1** | On design load or area create: resolve install address (opportunity / design) → `POST /api/org/geocode` → persist `satellite_lat`, `satellite_lng`, `satellite_zoom` on `design_areas`. |
| **0.2** | `design-canvas.tsx`: build `satelliteConfig` from active area’s `satellite_lat` / `satellite_lng` / `satellite_zoom` (+ opacity) and pass to `CanvasArea` (required for satellite layer to show). |
| **0.3** | Optional: PATCH area when user recenters map or changes zoom (persist map state). |
| **0.4** | **Interaction:** default = canvas-driven pan/zoom + `syncTransform` (current architecture). Map-first (gestures on map, overlay canvas for devices) = separate product decision. |
| **0.5** | Floor plan: API allows PNG, JPG, JPEG, SVG, PDF. Canvas uses `FabricImage.fromURL` — JPEG/SVG path; add PDF → raster (pdf.js or server) if PDF must display on Fabric. |

**Touches:** `src/app/api/org/designs/[id]/areas/route.ts`, `design-canvas.tsx`, design/opportunity fetch, `canvas-area.tsx`, `satellite-map.tsx`, floor-plans route + canvas loader for PDF if required.

---

## Phase A — Geospatial truth model

**Goal:** Single coherent model: design origin ↔ feet ↔ lat/lng so map and canvas stay aligned.

| Step | Work |
|------|------|
| **A1** | Single design origin from `satelliteConfig` center + `scalePxPerFt` (or feet-per-pixel at reference zoom). |
| **A2** | Audit `SatelliteMap.syncTransform` (CSS translate + scale vs Mercator); consider `OverlayView` / map overlay if drift is unacceptable. |
| **A3** | Integrate or remove unused `geo-math.ts` paths — avoid two diverging math paths. |

**Implemented:** `DesignGeoContext`, `buildDesignGeoContext`, `canvasPixelsToLatLng`, `latLngToCanvasPixels` in `src/components/design-canvas/geo-math.ts`; `design-canvas.tsx` → `CanvasArea` `geoContext` + ref for Phase B; `syncTransform` JSDoc; `geo-math.test.ts`.

---

## Phase B — Native map FOV layer (optional)

**Goal:** Optional `google.maps.Polygon` tiers from same logical FOV as Fabric; `generateFovConePolygon` in `geo-math.ts` where appropriate.

| Step | Work |
|------|------|
| **B1** | Per device: camera lat/lng from position + design center + scale (`pixelToLatLng`). |
| **B2** | Map rotation/bearing consistent with Fabric rotation in `canvas-area.tsx` / `fov-renderer.ts`. |
| **B3** | Update/recreate polygons on pan/zoom (throttle; align with FOV drag suppression). |
| **B4** | Wall occlusion on map requires walls in lat/lng + clip in geographic space — larger scope; short term: unclipped map polygons or clip on Fabric only. |

---

## Phase C — FOV editing parity & spec stability

| Step | Work |
|------|------|
| **C1** | Harden `__batch` / `__resetDori` + catalog `focal_length`, `sensor_w`, `resolution_w` (see **Recurring Bug: FOV Cone Reset** in `CLAUDE.md`). |
| **C2** | Multi-sensor / panoramic edge cases per Multi-Sensor Camera Rules in `CLAUDE.md`. |

---

## Phase D — Vendor-style scene / 3D / workflow

| Step | Work |
|------|------|
| **D1** | `camera-3d-preview.tsx` — improve or replace (WebGL/Three vs 2.5D) as scoped. |
| **D2** | `simulated-view.tsx` / `blind-spot-diagram.tsx` — fix or retire per roadmap. |
| **D3** | BOM / export — separate from FOV; scope explicitly. |

---

## Phase E — Verification matrix

| Check | Method |
|-------|--------|
| Address → satellite | Design with install address → area shows satellite at geocoded center; no address → defined fallback. |
| Pan/zoom | Wheel + drag at multiple zooms; imagery tracks; no runaway drift. |
| Floor plan | JPEG/SVG upload + render; PDF if Phase 0.5 implemented. |
| Fabric vs map FOV | If Phase B: alignment spot-checks. |
| Specs | Partial catalog specs → no FOV reset. |
