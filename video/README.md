# Sozu Credit Product Video

Programmatic product video built with [Remotion](https://www.remotion.dev), using onboarding slide assets from the main app.

## Preview

```bash
cd video
npm run dev
```

Opens Remotion Studio at `http://localhost:3000`.

## Render

Vertical (9:16, ideal for Reels/TikTok/Stories):

```bash
npx remotion render src/index.ts SozuProductVideo out/sozu-product-vertical.mp4
```

Single-frame preview:

```bash
npx remotion still src/index.ts SozuProductVideo out/preview.png --frame=90
```

## Assets

Assets are symlinked from the main app:

- `public/onboarding/` — slide screenshots + background
- `public/icons/` — Sozu app icon
- `public/sound/` — transition SFX
- `public/sozucapital_logo_tb.png` — outro logo

## Structure

| Scene | Duration | Content |
|-------|----------|---------|
| Intro | 4s | Logo + "Vouched, not Verified." |
| Slides 1–4 | 4.5s each | Onboarding screenshots with Ken Burns + caption |
| Outro | 4s | Logo + CTA + sozucredit.com |

Total runtime: ~22.7s at 30fps (680 frames).

## Customize

Edit `src/constants.ts` for timing, captions, and brand copy. Scene components live in `src/components/`.
