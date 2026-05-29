/**
 * Centralised tuning knobs for the GrainGradient background shader.
 * Changing a value here propagates everywhere the shader is rendered.
 */

/** Maximum physical pixel count for mobile WebGL canvases. ~720p equivalent. */
export const MOBILE_MAX_PIXEL_COUNT = 1280 * 720

/** Maximum physical pixel count for desktop. ~1080p × 2 dpi. */
export const DESKTOP_MAX_PIXEL_COUNT = 1920 * 1080 * 2

/**
 * minPixelRatio controls the minimum render resolution multiple.
 * 1 = native device pixel size (best for Android GPU budget).
 * 2 = default (Paper Shaders upstream, good for anti-aliasing on desktop).
 */
export const MOBILE_MIN_PIXEL_RATIO = 1
export const DESKTOP_MIN_PIXEL_RATIO = 2

/** Animation speeds — lower = slower shader internal clock = fewer GPU ops */
export const ORB_SPEED_LITE = 0.16   // vs upstream 0.55
export const ORB_SPEED_FULL = 0.28   // visually alive on desktop; still calmer than before

export const BLOB_A_SPEED_LITE = 0.07  // vs upstream 0.18
export const BLOB_B_SPEED_LITE = 0.14  // vs upstream 0.40

export const CORNERS_SPEED_LITE = 0.2  // vs upstream 0.3 (ledger/credit, desktop)
export const CORNERS_SPEED_FULL = 0.3
