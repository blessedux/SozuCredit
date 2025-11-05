# PWA Setup for SozuCredit

This document explains how the Progressive Web App (PWA) is configured for SozuCredit and how to complete the setup.

## What's Already Configured

✅ **Manifest.json** - PWA configuration file  
✅ **Service Worker** - Offline support and caching  
✅ **iOS Meta Tags** - Apple-specific PWA configuration  
✅ **Shared Background** - Animated background persists through navigation  
✅ **PWA Registration Component** - Automatically registers service worker

## What You Need to Do

### 1. Create App Icons

You need to create app icons in various sizes. Here's how:

#### Option A: Using the Icon Generation Script (Recommended)

1. Create a 1024x1024 PNG icon with your SozuCredit logo/brand
2. Save it as `public/icons/icon-base.png`
3. Run the generation script:

```bash
chmod +x scripts/generate-icons.sh
./scripts/generate-icons.sh
```

This will generate all required icon sizes:

- 72x72, 96x96, 128x128, 144x144, 152x152, 192x192, 384x384, 512x512

#### Option B: Manual Icon Creation

Create PNG icons in the following sizes and save them in `public/icons/`:

- `icon-72x72.png`
- `icon-96x96.png`
- `icon-128x128.png`
- `icon-144x144.png`
- `icon-152x152.png` (iOS)
- `icon-192x192.png`
- `icon-384x384.png`
- `icon-512x512.png`

### 2. Install on iPhone

Once icons are in place, users can install the app:

1. Open Safari on iPhone
2. Navigate to your SozuCredit webapp
3. Tap the Share button (square with arrow pointing up)
4. Scroll down and tap "Add to Home Screen"
5. Customize the name if needed (default: "SozuCredit")
6. Tap "Add"

The app will appear on the home screen with your custom icon.

### 3. Install on Android

Android users can install via:

1. Open Chrome on Android
2. Navigate to your SozuCredit webapp
3. Chrome will show an install banner, or:
4. Tap the menu (three dots) → "Install app" or "Add to Home screen"

## Features

### Smooth Animation Through Navigation

The animated background (FallingPattern) is now rendered at the root layout level, ensuring it persists smoothly through all route transitions. The animation is optimized for mobile devices and will maintain performance during navigation.

### Offline Support

The service worker caches:

- Static assets
- HTML pages
- CSS and JavaScript files

API calls are excluded from caching to ensure fresh data.

### Standalone Mode

When installed, the app runs in standalone mode:

- No browser UI
- Full screen experience
- App-like feel
- Black status bar (iOS)

## Testing

1. **Test Service Worker:**

   - Open DevTools → Application → Service Workers
   - Verify service worker is registered
   - Check "Offline" mode works

2. **Test Manifest:**

   - DevTools → Application → Manifest
   - Verify all icons are listed
   - Check theme colors

3. **Test on iPhone:**
   - Use Safari (required for PWA)
   - Test install process
   - Verify icon appears correctly
   - Test in standalone mode

## Troubleshooting

### Service Worker Not Registering

- Ensure HTTPS (required for service worker)
- Check browser console for errors
- Verify `sw.js` is accessible at `/sw.js`

### Icons Not Showing

- Verify all icon files exist in `public/icons/`
- Check manifest.json paths are correct
- Clear browser cache

### Animation Performance

- The FallingPattern is optimized for mobile
- If issues occur, check `components/ui/falling-pattern.tsx` for optimization options

## Next Steps

- [ ] Create and add app icons
- [ ] Test installation on iPhone
- [ ] Test installation on Android
- [ ] Verify offline functionality
- [ ] Test animation persistence during navigation
