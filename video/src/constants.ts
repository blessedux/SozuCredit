export const FPS = 30;

export const SCENE = {
  intro: 4 * FPS,
  slide: 135, // 4.5s at 30fps
  outro: 4 * FPS,
  transition: 20,
} as const;

export const SLIDES = [
  "onboarding/slide1.webp",
  "onboarding/slide2.webp",
  "onboarding/slide3.webp",
  "onboarding/slide4.webp",
] as const;

export const SLIDE_CAPTIONS = [
  "Creating your Smart Account",
  "Your passkey is the only key",
  "Access decentralized credit, privately",
  "Welcome to decentralized money",
] as const;

export const BRAND = {
  tagline: "Vouched, not Verified.",
  cta: "Credit for everyone.",
  url: "sozucredit.com",
  accent: "#6366f1",
  accentSoft: "rgba(99, 102, 241, 0.35)",
} as const;

/** Total frames for the vertical product video (TransitionSeries overlap accounted). */
export const VERTICAL_DURATION =
  SCENE.intro +
  SLIDES.length * SCENE.slide +
  SCENE.outro -
  (SLIDES.length + 1) * SCENE.transition;
