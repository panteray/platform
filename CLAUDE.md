# Panteray Platform — CLAUDE.md

## Project Overview
Physical security design platform. Next.js 15 App Router + React 19 + Supabase (PostgreSQL + RLS) + Fabric.js canvas.

## Design Canvas Architecture
- **Fabric.js** = canvas interaction/rendering engine
- **Google Maps** = synchronized satellite backdrop (passive, behind canvas)
- **FOV cones** = Fabric.js Polygons using LOCAL coordinates (0,0 = camera apex), positioned via left/top
- **Wall clipping** = Sutherland-Hodgman polygon clipping algorithm
- **DORI tiers** = IEC 62676-4 standard (Detection 8+ PPF, Observation 19+, Recognition 38+, Identification 76+)

## Key Files
- `src/components/design-canvas/canvas-area.tsx` — Fabric.js canvas (events, rendering, FOV cones, handles)
- `src/components/design-canvas/design-canvas.tsx` — Main orchestrator (FOV data computation, device lifecycle, toolbar)
- `src/components/design-canvas/fov-renderer.ts` — FOV geometry (buildConePoints, buildFovTiers)
- `src/components/design-canvas/device-renderer.ts` — Device icon creation (PNG→SVG→circle fallback)
- `src/components/design-canvas/polygon-clip.ts` — Wall occlusion
- `src/lib/calculators/fov-dori.ts` — DORI/PPF calculator (DO NOT CHANGE without understanding IEC 62676-4)

## Multi-Sensor Camera Architecture
Multi-sensor cameras (`multisensor_quad`, `multisensor_dual`) work like IPVM — each sensor head is an independent camera:
- **Per-sensor rotation**: Each sensor has its own rotation angle stored in `properties.sensor_angles` (number array)
- **Default angles**: Dual = `[base-45, base+45]`, Quad = `[base, base+90, base+180, base+270]`
- **Per-sensor FOV cones**: Each sensor renders its own cone polygon with own DORI tiers, centerline, and labels
- **Per-sensor handles**: Each sensor gets its own distance handle, angle handles, and rotation ring on canvas
- **Per-sensor drag**: Dragging a sensor's rotation ring independently adjusts that sensor's angle
- **Right panel controls**: Sensor Heads section with per-sensor rotation sliders
- **Shared specs**: All sensors share the same optics (focal length, sensor width, resolution) — only rotation differs
- **Sensor colors**: S1=#3b82f6, S2=#22c55e, S3=#f97316, S4=#a855f7

## Industry Research (IPVM / Hanwha DesignPro / Axis Site Designer)
- All major tools use Google Maps as foundation with FOV cones rendered on the map
- IPVM: Google Maps + map polygons (lat/lng) with DORI color tiers, wall occlusion
- Hanwha DesignPro: Google Maps + FOV cones + PPF zones + 3D preview
- Axis Site Designer: Google Maps + FOV visualization + 3D preview
- Our implementation: Fabric.js canvas + Google Maps as synchronized satellite backdrop
- FOV data computation logic in design-canvas.tsx is correct and reusable
- `fov-dori.ts` calculator engine is production-quality IEC 62676-4 implementation

## Critical Rules
- **Never use IBM Plex fonts** — use Inter for UI, system monospace for code/numbers
- FOV polygons use LOCAL coordinates (0,0 = apex), never absolute canvas coordinates
- Never call Fabric.js private `_calcDimensions()` — use `updateFovPolygon()` helper instead
- Device properties use snake_case: `sensor_w`, `sensor_h`, `focal_length`, `resolution_w`, `resolution_h`, `target_distance`, `install_height`, `tilt_angle`
- The `properties` JSONB field on DesignDevice is untyped — always use correct snake_case keys

## Font Policy
- UI text: `'Inter', 'Segoe UI', sans-serif`
- Monospace/numbers: `'SF Mono', 'Cascadia Code', 'Consolas', monospace`
- Canvas labels: `'sans-serif'` (system default)
- **Never use**: IBM Plex Mono, IBM Plex Sans

## Build & Test
```bash
pnpm install          # Install deps
pnpm build            # Production build (includes lint)
npx tsc --noEmit      # Type check only
npx next lint         # Lint only
```

## Git
- Always use `pnpm-lock.yaml` (not package-lock.json) — CI uses `--frozen-lockfile`
- Commit with descriptive messages
- Push with `git push -u origin <branch>`
