# IPVM-Style Canvas/UI Patterns

This document describes the new UI/UX and architectural patterns implemented in the platform's design canvas to match IPVM standards.

## Features & Patterns

### 1. Drag Suppression for FOV Geometry
- FOV cones are hidden during device drag operations to prevent visual clutter.
- Canvas logic uses state to suppress FOV rendering while dragging.

### 2. Glow-on-Change for Calculator Inputs
- Zone input fields glow for 1.6s after value changes, providing visual feedback.
- Implemented via transient state and CSS box-shadow.

### 3. Animated Preview for FOV Cones
- FOV cones animate smoothly using requestAnimationFrame for transitions.
- Geometry updates are interpolated for live preview.

### 4. Mobile Input Optimization
- Calculator input fields use type='tel' for improved mobile usability.

### 5. Cascading Validation for Zone Inputs
- Sequential validation for X, Y, Width, Height with specific error messages.
- Errors are shown inline and as spatial error bubbles anchored to the canvas zone.

### 6. Dual-Track State: Presentation vs Raw Values
- Device and zone values are separated between raw data and formatted display.
- Conversion functions ensure accurate presentation and editing.

### 7. Spatial Error Bubbles
- Validation errors are rendered as anchored bubbles above the affected zone geometry.
- Uses Fabric.js text overlays for spatial feedback.

### 8. Auto-Generated Device Narratives
- Access control devices display a narrative summary generated from device properties.
- Narrative logic is in wiring-schematic.ts and integrated in right-panel.tsx.

### 9. Requirements Gauge Bars
- Engineering metrics (bandwidth, storage, PoE, switch capacity) are shown as gauge bars.
- Gauge bars display live values, required baselines, and delta badges.

### 10. General UI/UX Enhancements
- Accessibility: ARIA attributes, keyboard focus indicators, improved tab navigation.
- Animation polish: FOV cone transitions, minimap sync.
- Responsive layouts: Panel and canvas adapt to screen size.

## Testing & QA
- All updated files pass lint and error checks.
- Features validated for usability, accessibility, and correctness.

## File References
- canvas-area.tsx: Canvas logic, FOV rendering, drag suppression, accessibility.
- right-panel.tsx: Zone input fields, validation, device narratives.
- requirements-bar.tsx: Gauge bar rendering.
- wiring-schematic.ts: Narrative generation logic.

## How to Extend
- Follow modular patterns for new UI features.
- Use state separation for presentation vs raw values.
- Anchor error messages and feedback to spatial geometry for clarity.
- Ensure accessibility and responsive design in all new components.

---
For further details, see the referenced files and comments in the codebase.