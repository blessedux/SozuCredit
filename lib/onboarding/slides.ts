export const WALLET_ACTIVATION_SLIDE_COUNT = 4

/**
 * Spanish slide assets (public/onboarding/es/).
 * The component's onError handler falls back to FALLBACK automatically.
 */
export const WALLET_ACTIVATION_SLIDES_ES = [
  "/onboarding/es/slide1_Es.webp",
  "/onboarding/es/slide2_es.webp",
  "/onboarding/es/slide3_es.webp",
  "/onboarding/es/slide4_es.webp",
] as const

export const WALLET_ACTIVATION_SLIDES_FALLBACK = [
  "/onboarding/slide1.webp",
  "/onboarding/slide2.webp",
  "/onboarding/slide3.webp",
  "/onboarding/slide4.webp",
] as const
