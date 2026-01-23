# App Icons

## Generated Icons

All app icons have been generated from the new SVG design (`src/assets/favicon.svg`).

### Files Created:
- **macOS**: `src/assets/app.icns` (467KB) - Used for macOS app icon
- **Windows**: `src/assets/favicon-win.ico` (82KB) - Used for Windows app icon  
- **Linux**: `src/assets/favicon_512x512.png` - Used for Linux app icon
- **Web**: `src/assets/favicon.svg` - Used for browser favicon

## Design
The new icon features:
- Modern purple gradient background (#667eea → #764ba2)
- White microphone symbol
- Sound waves radiating outward
- Clean, minimal design that scales well

## Regenerating Icons

If you update `src/assets/favicon.svg`, regenerate all platform icons:

```bash
./generate-icons.sh
```

**Requirements:**
- `librsvg` - for SVG to PNG conversion: `brew install librsvg`
- `imagemagick` - for ICO creation: `brew install imagemagick`
- `iconutil` - built into macOS

## Icon Sizes

The iconset includes all required macOS sizes:
- 16x16, 32x32, 64x64, 128x128, 256x256, 512x512, 1024x1024
- Plus @2x retina versions

Windows ICO includes: 16x16, 32x32, 128x128, 256x256
