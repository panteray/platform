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

## Git
- Always use `pnpm-lock.yaml` (not package-lock.json) — CI uses `--frozen-lockfile`
- Commit with descriptive messages
- Push with `git push -u origin <branch>`
