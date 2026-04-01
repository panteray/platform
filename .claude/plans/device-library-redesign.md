# Device Library Redesign — DesignPro-style

## Overview

Redesign the device library to match Hanwha DesignPro's device selection UX:
- Card grid layout grouped by form factor (replaces table)
- Button-based toggle filters (replaces dropdown `<select>` elements)
- Works as both a standalone page AND a modal from the canvas
- Right sidebar with FoV/Acc/Lens/License tabs per selected device (canvas context only)
- Fix resolution filter repopulation bug
- Remove the old `device-catalog-modal.tsx`

---

## Phase 1: Shared Device Grid Component

**New file: `src/components/device-library/device-grid.tsx`**

A shared component usable by both the page and the modal. Contains:

- **Category tabs** across top: CCTV, Access Control, Network, AV, Sensors (matching ICON_TABS)
- **Filter bar** with button toggles (not dropdowns):
  - Resolution: Any | 2MP | 4MP | 5MP | 4K | 12MP+
  - Form factor: icon buttons (Box, Bullet, Dome, Turret, PTZ, Fisheye, Covert, Cube, Multi) using existing `FormIcon` SVGs from catalog modal
  - NDAA: Any | Compliant | Non-compliant
  - Search input
- **Card grid** grouped by form factor (e.g., "Box (20)", "Bullet (62)"):
  - Each card: form factor icon (using existing `FormIcon`), model name, resolution/description, vendor
  - Click card → callback (select for canvas, or open detail drawer for library page)
  - Hover → highlight
- **Props interface**:
  ```ts
  interface DeviceGridProps {
    category?: string           // pre-filter by category
    onSelect?: (device) => void // when user picks a device
    mode: 'browse' | 'select'  // browse = library page, select = canvas modal
  }
  ```

**Data fetching**: Uses the existing `/api/org/device-library/search` API. Fetches all results (batched 1000), filters client-side for resolution/form (same pattern as current catalog modal).

---

## Phase 2: Device Library Page Redesign

**File: `src/app/(authenticated)/org/tools/device-library/page.tsx`**

- Replace the entire table+dropdown layout with `<DeviceGrid mode="browse" />`
- Keep the existing side drawer (`SideDrawer`) for viewing/editing device specs
- Keep bulk edit, delete, import/enrich header actions
- Card click → opens side drawer (same as current row click)
- Remove dropdown `<select>` filters for resolution, form, vendor, category, NDAA
- Category tabs replace category dropdown
- Vendor filter → brand panel (left column, like current catalog modal) OR dropdown stays since DesignPro uses a filter modal for this

**Resolution bug fix**:
- Currently `resolutions` is derived from `results` (filtered). When filtered by "4MP", only "4MP" shows in options. After editing and returning to "All", the fetch should repopulate but the derived options list was stale.
- Fix: Button-based resolution filter eliminates this entirely — the buttons are hardcoded (Any, 2MP, 4MP, 5MP, 4K, 12MP+), not derived from results. This is how the catalog modal already works and it has no bug.

---

## Phase 3: Canvas Modal Replacement

**File: `src/components/design-canvas/device-catalog-modal.tsx`** → DELETE

**New file: `src/components/design-canvas/device-library-modal.tsx`**

A thin modal wrapper around `<DeviceGrid mode="select" />`:
- Same overlay/modal chrome as current catalog modal (fixed position, backdrop, close button)
- Passes `category` from active canvas tab
- `onSelect` callback → calls existing `handleDeviceSelected` in design-canvas.tsx
- "+ Add Custom Device" form preserved (moved into this wrapper or into DeviceGrid)

**File: `src/components/design-canvas/design-canvas.tsx`** — Changes:
- Import `DeviceLibraryModal` instead of `DeviceCatalogModal`
- Same `showCatalog` state, same `handleDeviceSelected` callback
- No functional change to the canvas — just swaps the modal component

**File: `src/components/design-canvas/left-panel.tsx`** — No changes needed (already calls `onAddDevice` which opens the modal)

---

## Phase 4: Right Sidebar FoV/Acc/Lens/License Tabs

**File: `src/components/design-canvas/right-panel.tsx`** — Changes:

Currently the right panel shows device properties (focal length, target distance, etc.) in collapsible sections. Add DesignPro-style tabs:

- **Tab bar** below device model name: `FoV | Acc | Lens | License`
- **FoV tab** (default): Current right panel content (focal length, target distance, install height, tilt, DORI feedback) — already exists, just wrapped in the tab
- **Acc tab**: Mounting/accessory info — form factor, mount type selector, environment (indoor/outdoor). Pull from device specs.
- **Lens tab**: Lens specifications — focal length range, zoom ratio, sensor size. Pull from device specs.
- **License tab**: Placeholder for future license/analytics features

This only appears when a device is selected on the canvas (already the current behavior — right panel only shows when `selectedDeviceId` is set).

---

## Files Changed Summary

| File | Action | Description |
|------|--------|-------------|
| `src/components/device-library/device-grid.tsx` | CREATE | Shared card grid component |
| `src/app/(authenticated)/org/tools/device-library/page.tsx` | REWRITE | Card grid + button filters, keep edit drawer |
| `src/components/design-canvas/device-library-modal.tsx` | CREATE | Modal wrapper for canvas use |
| `src/components/design-canvas/device-catalog-modal.tsx` | DELETE | Old catalog modal |
| `src/components/design-canvas/design-canvas.tsx` | EDIT | Swap import from catalog-modal to library-modal |
| `src/components/design-canvas/right-panel.tsx` | EDIT | Add FoV/Acc/Lens/License tab bar |

---

## What is NOT changing

- API routes (search, items, import, etc.) — no backend changes
- `useDeviceLibrary` hook — still used by the page for pagination/sorting
- Left panel device list — no changes
- Canvas interaction, FOV rendering, device placement — no changes
- Device comparison panel — no changes
- Import/Enrich/Manufacturers sub-pages — no changes

---

## Implementation Order

1. Create `device-grid.tsx` shared component (the core piece)
2. Create `device-library-modal.tsx` (modal wrapper)
3. Swap canvas modal import in `design-canvas.tsx`
4. Rewrite device library page to use `DeviceGrid`
5. Add tabs to right panel
6. Delete old `device-catalog-modal.tsx`
7. Test: resolution filter bug gone, card grid works, canvas add device flow works
