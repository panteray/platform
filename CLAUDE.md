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
- **Per-sensor handles**: Each sensor gets distance handle, angle handles, and rotation ring (all per-imager)
- **Per-sensor drag**: Dragging a sensor's distance/angle handle ONLY affects that sensor's cone
- **Per-sensor persistence**: Handle changes persist to `properties.per_imager_props[sIdx]` (not global)
- **__sensorIdx tagging**: Each cone polygon is tagged with `__sensorIdx` for precise drag targeting
- **Right panel controls**: Sensor Heads section with per-sensor rotation sliders + Imager navigation
- **perImagerData**: Always generated for multi-sensor cameras (provides per-sensor tiers, hFov, color)
- **Shared specs**: All sensors share same optics (focal length, sensor width, resolution) — rotation/distance/angle differ
- **Sensor colors**: S1=#3b82f6, S2=#22c55e, S3=#f97316, S4=#a855f7 (module constant `SENSOR_COLORS`)
- **Lock Camera** (IPVM): `properties.locked` prevents device drag, only imagers rotate
- **IPVM behavior**: Each imager is independently adjustable (distance, FOV width, rotation). Entire camera moves as one assembly. IPVM supports 2–5 imagers per multi-sensor camera.
- **180/360 panoramic**: Uses circle circumference formula (2*pi*r) not triangle-based cone — different from standard multi-sensor

## Non-Camera Coverage Boundaries (System Surveyor)
- Speakers and environmental/vape sensors get circular coverage zones on canvas
- Configurable via `properties.coverage_radius` (ft)
- Default: speakers=25ft (#8b5cf6), vape_environmental=15ft (#14b8a6)
- Uses same FOV rendering pipeline with 360° hFov and single opacity tier

## Industry Research (IPVM / Hanwha DesignPro / Axis Site Designer)
- All major tools use Google Maps as foundation with FOV cones rendered on the map
- IPVM: Google Maps + map polygons (lat/lng) with DORI color tiers, wall occlusion
- Hanwha DesignPro: Google Maps + FOV cones + PPF zones + 3D preview
- Axis Site Designer: Google Maps + FOV visualization + 3D preview
- Our implementation: Fabric.js canvas + Google Maps as synchronized satellite backdrop
- FOV data computation logic in design-canvas.tsx is correct and reusable
- `fov-dori.ts` calculator engine is production-quality IEC 62676-4 implementation

## Critical Rules
- **Do not argue with Dexter.** Follow his directions exactly. Do not defend yourself, explain why something can't be done, or push back. Just do what he says.
- **This environment is Claude Code web (claude.ai/code)** running in a sandboxed container with a restrictive egress proxy. It CANNOT reach Supabase, Cloud Run, OneDrive, or most external services. Do not waste time trying. Accept this limitation and work within it.
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
Review Plan Before Implementation
Review the current plan thoroughly before making any code changes. For every issue or recommendation, explain the concrete tradeoffs, give an opinionated recommendation, and ask for user input before assuming a direction.

Engineering Preferences
Use these to guide your recommendations (override with project-specific CLAUDE.md preferences if they exist):

DRY is important: flag repetition aggressively
Well-tested code is non-negotiable: prefer too many tests over too few
Code should be "engineered enough": not under-engineered (fragile, hacky) and not over-engineered (premature abstraction, unnecessary complexity)
Err on the side of handling more edge cases, not fewer
Bias toward explicit over clever; thoughtfulness over speed
Review Pipeline
Work through each section sequentially. After each section, pause and ask for feedback before moving on.

1. Architecture Review
Evaluate:
Overall system design and component boundaries
Dependency graph and coupling concerns
Data flow patterns and potential bottlenecks
Scaling characteristics and single points of failure
Security architecture (auth, data access, API boundaries)
2. Code Quality Review
Evaluate:
Code organization and module structure
DRY violations (be aggressive here)
Error handling patterns and missing edge cases (call these out explicitly)
Technical debt hotspots
Areas that are over-engineered or under-engineered relative to engineering preferences
3. Test Review
Evaluate:
Test coverage gaps (unit, integration, e2e)
Test quality and assertion strength
Missing edge case coverage (be thorough)
Untested failure modes and error paths
4. Performance Review
Evaluate:
N+1 queries and database access patterns
Memory-usage concerns
Caching opportunities
Slow or high-complexity code paths
Issue Reporting Format
For every specific issue found (bug, smell, design concern, or risk):

Describe the problem concretely, with file and line references
Present 2-3 options, including "do nothing" where that's reasonable
For each option, specify: implementation effort, risk, impact on other code, and maintenance burden
Give your recommended option and why, mapped to engineering preferences above
Ask explicitly whether the user agrees or wants to choose a different direction before proceeding
Workflow
Do not assume priorities on timeline or scale
After each section, pause and ask for feedback before moving on
Use AskUserQuestion for structured option selection
Before Starting
Ask if the user wants one of two options:

BIG CHANGE: Work through this interactively, one section at a time (Architecture → Code Quality → Tests → Performance) with at most 4 top issues in each section
SMALL CHANGE: Work through interactively ONE question per review section
Tips
Combine with .claude/rules/ files for project-specific review criteria
Engineering preferences above can be overridden by your project's CLAUDE.md
For deeper analysis, use this command with Opus model
$ARGUMENTS

## Supabase
- **Production project**: `znepjevqtbhijqvlxpmq` (`https://znepjevqtbhijqvlxpmq.supabase.co`)
- **IMPORTANT**: The Supabase MCP integration CANNOT access this project. Do NOT use the MCP Supabase tools for panteray/platform. They only have access to casdex (`uhapfjjanaieucfripuo`) which is a DIFFERENT project.
- **Database migrations**: Must be run manually by the user in the Supabase dashboard SQL editor, or via `supabase db push`. Always provide the SQL and ask the user to run it.
- **Never make assumptions** about which Supabase project to use. The project is `znepjevqtbhijqvlxpmq`, period.

## Git
- Always use `pnpm-lock.yaml` (not package-lock.json) — CI uses `--frozen-lockfile`
- Commit with descriptive messages
- Push with `git push -u origin <branch>`
