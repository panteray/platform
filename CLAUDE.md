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
