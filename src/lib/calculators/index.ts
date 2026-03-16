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

export { calculateFovDori, getFovConeTiers, getFovConeParams, canvasDeviceToFovInput, validateFovInput, COMMON_SENSORS } from './fov-dori'
export type { FovDoriInput, FovDoriOutput, FovDoriInputPartial, FovValidation, CanvasFovDevice, DoriClassification } from './fov-dori'

export { calculateLpr, canvasDeviceToLprInput, canvasDevicesToLprInputs, validateLprInput } from './lpr'
export type { LprInput, LprOutput, CanvasLprDevice, LprInputPartial, LprValidation } from './lpr'

export { calculateSystemStorage, canvasDevicesToCameraSpecs, validateStorageInput } from './system-storage'
export type { SystemStorageInput, SystemStorageOutput, CameraSpec, CanvasStorageDevice, StorageValidation, StorageCameraValidation } from './system-storage'

export { calculateSolar } from './solar'
export type { SolarInput, SolarOutput } from './solar'

export { generateWiringSchematic, validateWiringInput } from './wiring-schematic'
export type { WiringInput, WiringOutput, SchematicType, WiringValidation } from './wiring-schematic'

export { runCableEstimator, checkCableOverage, CABLE_TYPES } from './cable-estimator'
export type { CableEstimatorInput, CableEstimatorOutput, CableRun } from './cable-estimator'

export { calculateMountRequirements, validateMountInput } from './mount-calculator'
export type { MountCalcInput, MountCalcOutput, MountOption } from './mount-calculator'

export { calculateWirelessPtp, validateWirelessInput } from './wireless-ptp'
export type { WirelessPtpInput, WirelessPtpOutput, WirelessPtpInputPartial, WirelessValidation } from './wireless-ptp'

export { runAcsEngine } from './acs-calculator'
export type { AcsBuildInput, AcsBuildOutput, WiringSpec } from './acs-calculator'

export { calculateCableLength } from './cable-math'
export type { WaypointLike } from './cable-math'
