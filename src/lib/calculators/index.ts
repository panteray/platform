/**
 * Panteray Calculator Engines — Central Export
 *
 * 9 engines, all dual-mode (standalone + integrated).
 * Shared architecture: same engine, different input source.
 *
 * ZERO DEFAULTS: All equipment specs from device library.
 * All site conditions from user input on canvas.
 * No hardcoded fallbacks for any equipment parameter.
 */

export { calculateFovDori, getFovConeTiers, getFovConeParams, canvasDeviceToFovInput, validateFovInput, classifyDori, calculatePpfAtDistance, COMMON_SENSORS } from './fov-dori'
export type { FovDoriInput, FovDoriOutput, FovDoriInputPartial, FovValidation, CanvasFovDevice, DoriClassification } from './fov-dori'

export { calculateSystemStorage, canvasDevicesToCameraSpecs, validateStorageInput } from './system-storage'
export type { SystemStorageInput, SystemStorageOutput, CameraSpec, CanvasStorageDevice, StorageValidation, StorageCameraValidation } from './system-storage'

export { generateWiringSchematic, validateWiringInput, buildNarrative } from './wiring-schematic'
export type { WiringInput, WiringOutput, SchematicType, WiringValidation } from './wiring-schematic'

export { runCableEstimator, checkCableOverage, CABLE_TYPES } from './cable-estimator'
export type { CableEstimatorInput, CableEstimatorOutput, CableRun } from './cable-estimator'

export { calculateMountRequirements, validateMountInput } from './mount-calculator'
export type { MountCalcInput, MountCalcOutput, MountOption } from './mount-calculator'
export { loadMountCatalog, lookupMountParts, listModelsForVendor, MOUNT_CATALOG_VENDORS } from './mount-catalog'
export type { MountCatalog, MountCatalogVendor, VendorMountPart } from './mount-catalog'

export { calculateWirelessPtp, validateWirelessInput } from './wireless-ptp'
export type { WirelessPtpInput, WirelessPtpOutput, WirelessPtpInputPartial, WirelessValidation } from './wireless-ptp'

export { runAcsEngine } from './acs-calculator'
export type { AcsBuildInput, AcsBuildOutput, WiringSpec } from './acs-calculator'

export { calculateCableLength } from './cable-math'
export type { WaypointLike } from './cable-math'

export { calculateCoverageArea, validateCoverageAreaInput } from './coverage-area'
export type { CoverageAreaInput, CoverageAreaOutput } from './coverage-area'

export { runPlanReview, loadJurisdictionRules } from './plan-review'
export type { PlanReviewInput, PlanReviewOutput, PlanReviewFinding, JurisdictionRules } from './plan-review'

export { calculateLens, validateLensInput, COMMON_FOCAL_LENGTHS } from './lens-calculator'
export type { LensCalcInput, LensCalcOutput } from './lens-calculator'
