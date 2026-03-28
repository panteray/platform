# CLAUDE.md — Panteray Platform

> Read this file fully before every response. No exceptions.

---

## 🚫 Non-Negotiables
- Do NOT create or export any file without explicit instruction
- Do NOT suggest unapproved scope changes
- Do NOT argue or push back on decisions — Dexter's word is final
- Do NOT repeat past mistakes listed in this file
- Do NOT add features, refactor, or "improve" anything not explicitly requested
- If ambiguous → ASK, never interpret

---

## ⚠️ Verification Rules
- **Never claim code works.** Say "pushed — not verified in browser."
- **Never blame the user.** If Dexter says it doesn't work, the code is wrong.
- **Claude cannot verify Fabric.js canvas interactions from the terminal.** Do not pretend otherwise.
- After a failed fix → stop, ask for a screen recording, do not guess again
- TypeScript errors = 0 does NOT mean the feature works. Browser testing is the only verification.

---

## ⚠️ Investigation Rules
- Trace code paths first — never guess, never assume
- Check for recurring issues before deep-diving (see Recurring Bugs below)
- Do not go down rabbit holes — stay focused on the reported issue
- Do not ask Dexter to reproduce — investigate the code yourself

---

## ⚠️ Canvas Rules
- **Canvas is the source of truth.** The sidebar reflects it — never the other way around
- Canvas drag must NEVER be constrained by sidebar values, slider limits, or input field caps
- If the user changes something on the canvas, the sidebar updates to match
- **No sliders. Ever. This has been stated repeatedly.**
- Only change exactly what is asked — do not touch working code

---

## Stack
- **Framework:** Next.js 15.1 (App Router, Turbopack dev)
- **UI:** React 19
- **Language:** TypeScript 5.7
- **Styling:** Tailwind CSS 3.4 + Radix UI + class-variance-authority
- **Components:** Radix UI (avatar, dialog, dropdown, label, scroll-area,
  select, separator, slot, switch, tabs, tooltip) + lucide-react
- **Canvas:** Fabric.js 6.9
- **Maps:** @vis.gl/react-google-maps 1.7
- **Database:** Supabase (PostgreSQL + RLS) — @supabase/supabase-js 2.49 + @supabase/ssr 0.5
- **Notifications:** Sonner
- **PDF:** pdf-parse + pdfjs-dist
- **Spreadsheet:** xlsx
- **Testing:** Vitest 2.1
- **Package manager:** pnpm 10.33 — lockfile: `pnpm-lock.yaml` (CI uses `--frozen-lockfile`)
- **Prod hosting:** Google Cloud Run (us-east1)
- **CI/CD:** Google Cloud Build (auto-deploys on push to main, ~3–5 min)

---

## Scripts
```bash
pnpm dev          # Next dev with Turbopack
pnpm build        # Production build
pnpm test         # Vitest run
pnpm test:watch   # Vitest watch
pnpm db:push      # supabase db push
pnpm db:types     # Generate TS types → src/types/supabase.ts
pnpm db:sync      # db:push + db:types together
npx tsc --noEmit  # Type check only
npx next lint     # Lint only
```

---

## Supabase
- **Production project ID:** `znepjevqtbhijqvlxpmq`
- **URL:** `https://znepjevqtbhijqvlxpmq.supabase.co`
- Supabase MCP tools **cannot** access this project
- MCP only has access to `casdex` (`uhapfjjanaieucfripuo`) — different project entirely
- DB migrations: run via `pnpm db:push` or manually in Supabase dashboard SQL editor
- Always provide SQL and confirm with user before assuming it ran
- Never mix up panteray and casdex project IDs

---

## Infrastructure
| Layer | Service | Status |
|---|---|---|
| Hosting | Google Cloud Run (us-east1) | DEPLOYED |
| CI/CD | Google Cloud Build | OPERATIONAL |
| Database | Supabase PostgreSQL | OPERATIONAL |
| Auth | Supabase Auth | CONNECTED |
| Storage | Supabase Storage (`org-assets`) | OPERATIONAL |
| Source | GitHub (`panteray/platform`) | OPERATIONAL |
| Maps API Key | `GOOGLE_MAPS_STATIC_KEY` | Server-side only — served via `/api/org/maps-key` |


---

## Design Canvas Architecture
- **Fabric.js** = canvas interaction/rendering engine
- **Google Maps** = passive satellite backdrop (behind canvas, synchronized)
- **FOV cones** = Fabric.js Polygons — LOCAL coordinates only (0,0 = camera apex)
- **Wall clipping** = Sutherland-Hodgman polygon clipping algorithm
- **DORI tiers** = IEC 62676-4 — 6 tiers: Monitor 4+ PPF, Detection 8+, Observation 19+, Recognition 38+, Identification 76+, Inspection 305+
- **DORI colors**: Monitor=#6b7280, Detection=#ef4444, Observation=#f97316, Recognition=#eab308, Identification=#22c55e, Inspection=#8b5cf6

### Key Files
- `src/components/design-canvas/canvas-area.tsx` — events, rendering, FOV cones, handles
- `src/components/design-canvas/design-canvas.tsx` — orchestrator, FOV data, device lifecycle, toolbar
- `src/components/design-canvas/fov-renderer.ts` — FOV geometry (buildConePoints, buildFovTiers)
- `src/components/design-canvas/device-renderer.ts` — device icon creation (PNG→SVG→circle fallback)
- `src/components/design-canvas/polygon-clip.ts` — wall occlusion
- `src/components/design-canvas/satellite-map.tsx` — dedicated satellite map component
- `src/components/design-canvas/device-catalog-modal.tsx` — IPVM-style 3-col device catalog (unverified)
- `src/components/design-canvas/blind-spot-diagram.tsx` — F4 blind spot (broken)
- `src/components/design-canvas/simulated-view.tsx` — F3 simulated scene (broken)
- `src/components/design-canvas/use-maps-api-key.ts` — fetches Maps key via `/api/org/maps-key`
- `src/lib/calculators/fov-dori.ts` — ⚠️ DO NOT CHANGE without understanding IEC 62676-4

### Industry Reference (IPVM / Hanwha DesignPro / Axis Site Designer)
- All major tools: Google Maps foundation + FOV cones rendered on map
- IPVM: Google Maps + map polygons (lat/lng) + DORI color tiers + wall occlusion
- Hanwha DesignPro: Google Maps + FOV cones + PPF zones + 3D preview
- Axis Site Designer: Google Maps + FOV visualization + 3D preview
- Our approach: Fabric.js canvas + Google Maps as synchronized satellite backdrop
- `fov-dori.ts` is production-quality IEC 62676-4 — FOV logic in `design-canvas.tsx` is correct and reusable

---

## Multi-Sensor Camera Rules
- Each sensor head = independent camera (IPVM pattern)
- Per-sensor rotation → `properties.sensor_angles` (number array)
- Default angles: Dual = `[base-45, base+45]`, Quad = `[base, base+90, base+180, base+270]`
- Per-sensor FOV cones: own DORI tiers, centerline, and labels
- Per-sensor handles: distance handle, angle handles, rotation ring — all per-imager
- Per-sensor drag: affects ONLY that sensor's cone
- Per-sensor persistence → `properties.per_imager_props[sIdx]`
- Each cone tagged with `__sensorIdx` for precise drag targeting
- `perImagerData` always generated for multi-sensor cameras (per-sensor tiers, hFov, color)
- Right panel: Sensor Heads section with per-sensor rotation sliders + Imager navigation
- Shared specs: all sensors share optics (focal length, sensor width, resolution)
- Sensor colors: S1=#3b82f6, S2=#22c55e, S3=#f97316, S4=#a855f7 (`SENSOR_COLORS` constant)
- `properties.locked` = Lock Camera — device drag disabled, imagers rotate only
- IPVM supports 2–5 imagers per multi-sensor camera
- 180/360 panoramic: uses `2*pi*r` — NOT triangle-based cone

---

## Non-Camera Coverage (Speakers / Vape Sensors)
- Circular coverage zones via `properties.coverage_radius` (ft)
- Defaults: speakers=25ft (#8b5cf6), vape/environmental=15ft (#14b8a6)
- Uses same FOV pipeline with 360° hFov, single opacity tier

---

## Batch Update Pattern
When multiple device properties change simultaneously (e.g., distance handle drag):
- Send `onDeviceUpdateProp(id, '__batch', mergedObject)` with ALL changed props in one object
- `design-canvas.tsx` `__batch` handler calls `updateDevice(id, { properties: val })` directly
- Never call `onDeviceUpdateProp` twice sequentially for the same drag — second call reads stale state and clobbers the first

---

## Recurring Bug: FOV Cone Reset
**Symptom:** Add a camera → FOV renders → make any change → cone resets to default size

**Root cause:** Catalog specs from `item.specs` often lack `focal_length`, `sensor_w`, `resolution_w`.
When any property update fires, `{ ...props, [prop]: val }` preserves what's there but can't add what was never there.
The `__resetDori` handler then recalculates `target_distance` from missing/wrong specs.

**Key code paths:**
- Device creation: `design-canvas.tsx` L442–464 (catalogSpecs from library)
- FOV computation: `design-canvas.tsx` L216+ (fovData useMemo)
- `__batch` handler: `design-canvas.tsx` L172
- `__resetDori` handler: `design-canvas.tsx` L177
- `__sensorIdx` tagging: `canvas-area.tsx` L1307, L1439, L1486, L1517

**Check this first** before diagnosing any FOV-related issue.

---

## Critical Rules
- **Pan behavior (live code):** Left-click on empty canvas = pan. Left-click on device = select. Middle-click anywhere = pan. Space+drag = pan. Pan tool = pan everywhere.
- FOV polygons: LOCAL coordinates ONLY — never absolute canvas coordinates
- Never call Fabric.js private `_calcDimensions()` — use `updateFovPolygon()`
- Device properties snake_case: `sensor_w`, `sensor_h`, `focal_length`,
  `resolution_w`, `resolution_h`, `target_distance`, `install_height`, `tilt_angle`
- `properties` JSONB on DesignDevice is untyped — always use correct snake_case keys

---

## Font Policy
- UI text: `'Inter', 'Segoe UI', sans-serif`
- Monospace/numbers: `'SF Mono', 'Cascadia Code', 'Consolas', monospace`
- Canvas labels: `'sans-serif'` (system default)
- ❌ Never use: IBM Plex Mono, IBM Plex Sans — including cable labels

---

## End of Session — Always Do This
After every session update `/PANTERAY/PANTERAY_Master_Memory.md` in Dullnote:
- Update **Active Work** with what was worked on
- Move completed items to **Completed**
- Add any new rejected approaches to **Rejected**
- Update **Feature Status** table if anything changed
- Log the last commit hash under **Last Action**

---

## Git
- Lockfile: `pnpm-lock.yaml` only — never `package-lock.json`
- CI: `--frozen-lockfile`
- Push directly to main: `git push origin HEAD:main`
- Cloud Build deploys automatically (~3–5 min)
- Commit messages: descriptive
- SQL migration files live at repo root (no `supabase/migrations/` folder)

---

## Feature Status (updated 2026-03-27)
| # | Feature | Status |
|---|---|---|
| F1 | Per-imager multi-sensor | ✅ Works |
| F2 | Cable labels + dashed lines | 🔧 Partial — needs polyline routing |
| F3 | Simulated view | ❌ Broken |
| F4 | Blind spot diagram | ❌ Broken |
| F5 | DORI 6-tier | ❌ Broken |

---

## 🔄 Active Work
**Status:** CSV device library import (database cleared, import pipeline needed)
**Last action:** ← update each session
**Next step:** Build CSV import for device library

---

## ✅ Completed — Do Not Redo
- Zones removed from canvas
- Supabase migrations — all applied

---

## ❌ Rejected — Never Suggest Again
<!-- Add approaches here as they are ruled out -->
