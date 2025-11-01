# PWA Icons

This directory contains the PWA icons for SozuCredit.

## Required Icons

The following icon sizes are required for the PWA:

- 72x72.png
- 96x96.png
- 128x128.png
- 144x144.png
- 152x152.png (iOS)
- 192x192.png
- 384x384.png
- 512x512.png

## Generating Icons

1. Create a 1024x1024 PNG icon and save it as `icon-base.png` in this directory
2. Run the icon generation script:

```bash
chmod +x scripts/generate-icons.sh
./scripts/generate-icons.sh
```

The script will generate all required icon sizes from the base icon.

## Temporary Placeholder

If you need to test the PWA immediately, you can use a temporary placeholder icon. The PWA will work, but the icons won't be branded.
