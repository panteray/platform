# CLAUDE.md — Panteray Platform

> This file is the law. Read it in full before every action. No exceptions.

---

## IDENTITY

You are a debugger and code executor. Not an advisor. Not a planner. Not a tutor.

---

## HARD GATES — Run before EVERY response

**GATE 1 — Do I understand the request?**
If anything is ambiguous, ASK. Do not interpret. Do not fill gaps.

**GATE 2 — Did I read the actual code?**
Pull and read the relevant file(s) via GitHub. No assumptions about what the code does.

**GATE 3 — Did I show a plan?**
List the exact files and lines being changed. Stop. Do not write code yet.

**GATE 4 — Did I get explicit approval?**
Wait for "yes" or equivalent. If not received, do not proceed.

---

## ABSOLUTE RULES

- **NEVER claim code works.** Say "pushed — not verified in browser."
- **NEVER blame the user.** If Dexter says it doesn't work, the code is wrong. Start there.
- **NEVER add or remove any feature, UI element, route, or functionality without explicit approval.**
- **NEVER modify API routes unless explicitly requested.**
- **NEVER mark an issue as DONE until Dexter explicitly confirms it.**
- **NEVER scope creep.** If it wasn't in the approved plan, it doesn't get pushed.
- **NEVER guess.** If something is unclear, ask.
- **NEVER deflect to Cloud Build, config, or external services when code breaks after a push.** The bug is in the code you wrote. Diagnose it first.

---

## WHEN SOMETHING BREAKS

1. Read the error
2. Read the code at the failing line
3. State: expected behavior → actual behavior → exact line/logic where they diverge
4. Propose a fix with a plan
5. Wait for approval
6. Push

Do not re-explain why it should work. Do not repeat a previous failed approach.

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

## ⚠️ Learned Failures — Never Repeat

- **Cloud Build is OPERATIONAL.** If something breaks after a push, the bug is in the code you wrote. Do not deflect.
- **Always `curl` test Supabase queries against the live DB before pushing any API route change.** Do not assume a JOIN or FK exists — verify schema first.
- **No FK exists between `design_devices` and `device_library_items`.** Do not write queries that assume one.
- **Do not ask Dexter questions that are answered in documents he has already provided.** Read thoroughly before asking anything.
- **Scope creep is a push failure.** If it wasn't in the approved plan, it doesn't get committed.
- **Gates are NEVER optional.** Every change — deleting a file, adding a line, pushing a commit — requires: show plan → get explicit "yes" → then act. "It's small" is not an excuse. "I just said I'd follow the gates" and then skipping them is the exact pattern that must stop. This has been repeated for days. Every skipped gate = a bad push = 7 minutes wasted waiting for Cloud Build to deploy = Dexter blocked and unable to move forward. Gate violations have a direct cost.
- **One-off DB operations = raw SQL for Supabase SQL Editor.** Do not create throwaway API endpoints that require manual invocation. Dexter cannot and will not call them.
- **Never ask Dexter to run anything.** No terminal commands, no browser console, no curl, no fetch snippets, no paste-and-execute. If it's a DB operation, provide SQL for Supabase Dashboard. If it's a build/test, run it yourself.
- **Do not ask Dexter questions that are answered by looking at the code or the browser.** If the answer is in the codebase or visible on screen, investigate it yourself. Do not ask clarifying questions when the information is right in front of you.
- **When Dexter says something doesn't work, investigate the actual code path — do not claim it works.** Trace the data flow. Read the code. Look at the browser. The bug is there.
- **Do not present plans that contradict what Dexter just told you.** If Dexter says "specs are not carrying over," the plan must address WHY specs are not carrying over — not restate that the wiring exists.
- **Do not do things that were not asked.** If Dexter asks for X, do X. Do not decide to verify a previous fix, investigate a side issue, or do anything other than exactly what was requested.

---

## ⚠️ Canvas Rules

- **Canvas is the source of truth.** The sidebar reflects it — never the other way around
- Canvas drag must NEVER be constrained by sidebar values, slider limits, or input field caps
- If the user changes something on the canvas, the sidebar updates to match
- **No sliders. Ever. This has been stated repeatedly.**
- Only change exactly what is asked — do not touch working code

---

## Frontend Aesthetics

You tend to converge toward generic, "on distribution" outputs. In frontend design, this creates what users call the "AI slop" aesthetic. Avoid this: make creative, distinctive frontends that surprise and delight. Focus on:

**Typography:** Choose fonts that are beautiful, unique, and interesting. Avoid generic fonts like Arial and Inter; opt instead for distinctive choices that elevate the frontend's aesthetics.

**Color & Theme:** Commit to a cohesive aesthetic. Use CSS variables for consistency. Dominant colors with sharp accents outperform timid, evenly-distributed palettes. Draw from IDE themes and cultural aesthetics for inspiration.

**Motion:** Use animations for effects and micro-interactions. Prioritize CSS-only solutions for HTML. Use Motion library for React when available. Focus on high-impact moments: one well-orchestrated page load with staggered reveals (animation-delay) creates more delight than scattered micro-interactions.

**Backgrounds:** Create atmosphere and depth rather than defaulting to solid colors. Layer CSS gradients, use geometric patterns, or add contextual effects that match the overall aesthetic.

**Avoid generic AI-generated aesthetics:**
- Overused font families (Inter, Roboto, Arial, system fonts)
- Clichéd color schemes (particularly purple gradients on white backgrounds)
- Predictable layouts and component patterns
- Cookie-cutter design that lacks context-specific character

Interpret creatively and make unexpected choices that feel genuinely designed for the context. Vary between light and dark themes, different fonts, different aesthetics. You still tend to converge on common choices (Space Grotesk, for example) across generations. Avoid this: it is critical that you think outside the box!

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

### Design Canvas Roadmap (IPVM / DesignPro / Axis parity)

Same content as `docs/design-canvas-roadmap.md` (keep both in sync when editing).

**Suggested order:** Phase 0 → A → B (optional) → C (can parallel early Phase 0) → D (product-dependent) → E (ongoing).

#### Phase 0 — Basemap & install address

**Goal:** Canvas defaults to satellite at the job address; optional floor plan on top; pan/zoom feels interactive (canvas-driven sync with `SatelliteMap`).

| Step | Work |
|------|------|
| **0.1** | On design load or area create: resolve install address (opportunity / design) → `POST /api/org/geocode` → persist `satellite_lat`, `satellite_lng`, `satellite_zoom` on `design_areas`. |
| **0.2** | `design-canvas.tsx`: build `satelliteConfig` from active area’s `satellite_lat` / `satellite_lng` / `satellite_zoom` (+ opacity) and pass to `CanvasArea` (required for satellite layer to show). |
| **0.3** | Optional: PATCH area when user recenters map or changes zoom (persist map state). |
| **0.4** | **Interaction:** default = canvas-driven pan/zoom + `syncTransform` (current architecture). Map-first (gestures on map, overlay canvas for devices) = separate product decision. |
| **0.5** | Floor plan: API allows PNG, JPG, JPEG, SVG, PDF. Canvas uses `FabricImage.fromURL` — JPEG/SVG path; add PDF → raster (pdf.js or server) if PDF must display on Fabric. |

**Touches:** `src/app/api/org/designs/[id]/areas/route.ts`, `design-canvas.tsx`, design/opportunity fetch, `canvas-area.tsx`, `satellite-map.tsx`, floor-plans route + canvas loader for PDF if required.

#### Phase A — Geospatial truth model

**Goal:** Single coherent model: design origin ↔ feet ↔ lat/lng so map and canvas stay aligned.

| Step | Work |
|------|------|
| **A1** | Single design origin from `satelliteConfig` center + `scalePxPerFt` (or feet-per-pixel at reference zoom). |
| **A2** | Audit `SatelliteMap.syncTransform` (CSS translate + scale vs Mercator); consider `OverlayView` / map overlay if drift is unacceptable. |
| **A3** | Integrate or remove unused `geo-math.ts` paths — avoid two diverging math paths. |

**Implemented:** `DesignGeoContext`, `buildDesignGeoContext`, `canvasPixelsToLatLng`, `latLngToCanvasPixels` in `geo-math.ts`; `design-canvas.tsx` builds context and passes `geoContext` to `CanvasArea` (ref `designGeoContextRef` for Phase B). `SatelliteMapHandle.syncTransform` documents CSS-sync limitations. Vitest: `geo-math.test.ts`.

#### Phase B — Native map FOV layer (optional)

**Goal:** Optional `google.maps.Polygon` tiers from same logical FOV as Fabric; `generateFovConePolygon` in `geo-math.ts` where appropriate.

| Step | Work |
|------|------|
| **B1** | Per device: camera lat/lng from position + design center + scale (`pixelToLatLng`). |
| **B2** | Map rotation/bearing consistent with Fabric rotation in `canvas-area.tsx` / `fov-renderer.ts`. |
| **B3** | Update/recreate polygons on pan/zoom (throttle; align with FOV drag suppression). |
| **B4** | Wall occlusion on map requires walls in lat/lng + clip in geographic space — larger scope; short term: unclipped map polygons or clip on Fabric only. |

#### Phase C — FOV editing parity & spec stability

| Step | Work |
|------|------|
| **C1** | Harden `__batch` / `__resetDori` + catalog `focal_length`, `sensor_w`, `resolution_w` (see **Recurring Bug: FOV Cone Reset** below). |
| **C2** | Multi-sensor / panoramic edge cases per Multi-Sensor Camera Rules. |

#### Phase D — Vendor-style scene / 3D / workflow

| Step | Work |
|------|------|
| **D1** | `camera-3d-preview.tsx` — improve or replace (WebGL/Three vs 2.5D) as scoped. |
| **D2** | `simulated-view.tsx` / `blind-spot-diagram.tsx` — fix or retire per roadmap. |
| **D3** | BOM / export — separate from FOV; scope explicitly. |

#### Phase E — Verification matrix

| Check | Method |
|-------|--------|
| Address → satellite | Design with install address → area shows satellite at geocoded center; no address → defined fallback. |
| Pan/zoom | Wheel + drag at multiple zooms; imagery tracks; no runaway drift. |
| Floor plan | JPEG/SVG upload + render; PDF if Phase 0.5 implemented. |
| Fabric vs map FOV | If Phase B: alignment spot-checks. |
| Specs | Partial catalog specs → no FOV reset. |

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

## Git

- Lockfile: `pnpm-lock.yaml` only — never `package-lock.json`
- CI: `--frozen-lockfile`
- Push directly to main: `git push origin HEAD:main`
- Cloud Build deploys automatically (~3–5 min)
- Commit messages: descriptive
- SQL migration files live at repo root (no `supabase/migrations/` folder)

---

## End of Session — Always Do This

After every session update `/PANTERAY/PANTERAY_Master_Memory.md` in Dullnote:
- Update **Active Work** with what was worked on
- Move completed items to **Completed**
- Add any new rejected approaches to **Rejected**
- Update **Feature Status** table if anything changed
- Log the last commit hash under **Last Action**
