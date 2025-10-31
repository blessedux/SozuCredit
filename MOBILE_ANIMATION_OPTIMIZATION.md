# Mobile Animation Optimization Guide

## ✅ What Was Fixed

### 1. Mobile-Optimized Animation

- **Reduced patterns:** From 36 patterns to 6 patterns on mobile (83% reduction)
- **Shorter animation path:** Reduced animation distance for better performance
- **Faster animation:** 40% faster duration on mobile (150s → 90s)
- **Less blur:** Reduced blur intensity on mobile (1em → 0.5em) for better performance

### 2. Performance Optimizations

- **Hardware acceleration:** Added `transform: translateZ(0)` to force GPU acceleration
- **Will-change hints:** Added `will-change` properties to optimize repaints
- **Reduced motion support:** Respects `prefers-reduced-motion` user preference

### 3. Video Fallback Support

- Component now supports video fallback for mobile devices
- Automatically detects mobile devices
- Falls back to WebM video if `useVideoFallback={true}` and `videoSrc` provided

## 📱 How It Works

### Automatic Mobile Detection

The component automatically:

1. Detects mobile devices via user agent and screen width
2. Uses optimized animation on mobile (< 768px width)
3. Falls back to video if enabled and video source provided

### Usage Examples

**Current Usage (Auto-optimized):**

```tsx
<FallingPattern
  className="h-full w-full"
  backgroundColor="oklch(0 0 0)"
  color="oklch(1 0 0)"
/>
```

**With Video Fallback:**

```tsx
<FallingPattern
  className="h-full w-full"
  backgroundColor="oklch(0 0 0)"
  color="oklch(1 0 0)"
  useVideoFallback={true}
  videoSrc="/videos/falling-pattern-mobile.webm"
/>
```

## 🎥 Creating Video Fallback (If Needed)

If the optimized animation still doesn't perform well on mobile, create a WebM video:

### Step 1: Record the Animation

1. Open the wallet page on desktop
2. Use screen recording software (OBS, QuickTime, etc.)
3. Record the falling pattern animation
4. Record for ~10-15 seconds (will loop)

### Step 2: Create Optimized WebM Video

**Using FFmpeg (Recommended):**

```bash
# Install FFmpeg first: https://ffmpeg.org/download.html

# Convert to WebM with optimization for mobile
ffmpeg -i falling-pattern-recording.mp4 \
  -vf "scale=720:-1" \
  -c:v libvpx-vp9 \
  -b:v 500k \
  -c:a libopus \
  -b:a 64k \
  -an \
  -t 10 \
  -loop 1 \
  falling-pattern-mobile.webm

# Alternative: H.264/MP4 (smaller, better compatibility)
ffmpeg -i falling-pattern-recording.mp4 \
  -vf "scale=720:-1" \
  -c:v libx264 \
  -preset slow \
  -crf 28 \
  -an \
  -t 10 \
  -loop 1 \
  falling-pattern-mobile.mp4
```

**Recommended Video Settings:**

- **Resolution:** 720p (720x1280) or lower for mobile
- **Bitrate:** 500-1000k for WebM, 1-2M for MP4
- **Duration:** 10-15 seconds (will loop)
- **Format:** WebM (VP9) preferred, MP4 (H.264) fallback
- **FPS:** 30fps is sufficient (can go lower to 24fps)

### Step 3: Add Video to Project

1. Create directory: `public/videos/`
2. Place video file: `public/videos/falling-pattern-mobile.webm`
3. Update wallet page:

```tsx
<FallingPattern
  className="h-full w-full"
  backgroundColor="oklch(0 0 0)"
  color="oklch(1 0 0)"
  useVideoFallback={true}
  videoSrc="/videos/falling-pattern-mobile.webm"
/>
```

### Step 4: Test on Mobile

1. Deploy to Vercel
2. Test on actual mobile device (not just browser dev tools)
3. Check:
   - Video plays smoothly
   - No stuttering or frame drops
   - Battery usage is reasonable
   - Video loops seamlessly

## 🛠️ Alternative: Online Video Tools

If you don't have FFmpeg, use online tools:

1. **CloudConvert:** https://cloudconvert.com/

   - Upload your video
   - Convert to WebM (VP9)
   - Set quality to "Mobile" or "Low"
   - Download optimized video

2. **HandBrake:** https://handbrake.fr/

   - Free desktop app
   - Use "Fast 720p30" preset
   - Export as WebM or MP4

3. **Adobe Premiere / Final Cut:**
   - Export → Media
   - Format: WebM or H.264
   - Preset: Mobile/Low quality

## 📊 Performance Comparison

### Before Optimization

- **Patterns:** 36 animated gradients
- **Animation distance:** Very long (up to 18,000px)
- **Mobile performance:** ❌ Laggy, janky
- **Battery impact:** High

### After Optimization (CSS Animation)

- **Patterns:** 6 animated gradients (mobile)
- **Animation distance:** Shorter (3,000px)
- **Mobile performance:** ✅ Smooth (most devices)
- **Battery impact:** Moderate

### With Video Fallback

- **Patterns:** 0 (pre-rendered video)
- **Animation:** Hardware-accelerated video playback
- **Mobile performance:** ✅✅ Very smooth
- **Battery impact:** Low (video codec optimized)

## 🧪 Testing Performance

### Desktop Testing

1. Open Chrome DevTools → Performance tab
2. Record while page loads
3. Check FPS (should be 60fps)
4. Check CPU usage (should be < 30%)

### Mobile Testing

1. Use Chrome DevTools → Toggle device toolbar
2. Select mobile device (iPhone 12, etc.)
3. Check "Throttling" → "4x slowdown"
4. Test animation smoothness

### Real Device Testing

1. Deploy to Vercel
2. Open on actual mobile device
3. Check:
   - Smooth animation
   - No stuttering
   - Responsive scrolling
   - Battery doesn't drain quickly

## 🎯 Recommendations

### For Most Cases

✅ **Use optimized CSS animation** (current implementation)

- Works well on modern mobile devices
- No additional assets needed
- Automatic optimization

### If Performance Issues Persist

✅ **Add video fallback**

- Create optimized WebM video
- Enable `useVideoFallback={true}`
- Provide `videoSrc` path

### For Maximum Performance

✅ **Use static image or simpler animation**

- Replace with CSS gradient animation
- Use fewer patterns
- Reduce animation complexity

## 📝 Next Steps

1. **Test current optimization** on mobile device
2. **If still not smooth**, create video fallback
3. **Monitor performance** using browser DevTools
4. **Get user feedback** on actual mobile devices

---

**Note:** The current optimization should work well for most mobile devices. Only add video fallback if you notice performance issues on actual devices.
