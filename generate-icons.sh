#!/bin/bash

# Generate macOS app icon from SVG
# Requires: librsvg (brew install librsvg)

SVG_FILE="src/assets/favicon.svg"
ICONSET_DIR="src/assets/app.iconset"

# Create iconset directory
mkdir -p "$ICONSET_DIR"

# Generate all required sizes for macOS
rsvg-convert -w 16 -h 16 "$SVG_FILE" > "$ICONSET_DIR/icon_16x16.png"
rsvg-convert -w 32 -h 32 "$SVG_FILE" > "$ICONSET_DIR/icon_16x16@2x.png"
rsvg-convert -w 32 -h 32 "$SVG_FILE" > "$ICONSET_DIR/icon_32x32.png"
rsvg-convert -w 64 -h 64 "$SVG_FILE" > "$ICONSET_DIR/icon_32x32@2x.png"
rsvg-convert -w 128 -h 128 "$SVG_FILE" > "$ICONSET_DIR/icon_128x128.png"
rsvg-convert -w 256 -h 256 "$SVG_FILE" > "$ICONSET_DIR/icon_128x128@2x.png"
rsvg-convert -w 256 -h 256 "$SVG_FILE" > "$ICONSET_DIR/icon_256x256.png"
rsvg-convert -w 512 -h 512 "$SVG_FILE" > "$ICONSET_DIR/icon_256x256@2x.png"
rsvg-convert -w 512 -h 512 "$SVG_FILE" > "$ICONSET_DIR/icon_512x512.png"
rsvg-convert -w 1024 -h 1024 "$SVG_FILE" > "$ICONSET_DIR/icon_512x512@2x.png"

# Convert to icns
iconutil -c icns "$ICONSET_DIR" -o src/assets/app.icns

echo "✅ macOS app icon generated: src/assets/app.icns"

# Generate Windows icon (requires ImageMagick: brew install imagemagick)
convert "$ICONSET_DIR/icon_256x256.png" \
        "$ICONSET_DIR/icon_128x128.png" \
        "$ICONSET_DIR/icon_64x64.png" \
        "$ICONSET_DIR/icon_32x32.png" \
        "$ICONSET_DIR/icon_16x16.png" \
        src/assets/favicon-win.ico

echo "✅ Windows icon generated: src/assets/favicon-win.ico"

# Copy 512x512 for Linux
cp "$ICONSET_DIR/icon_512x512.png" src/assets/favicon_512x512.png

echo "✅ Linux icon generated: src/assets/favicon_512x512.png"
echo "✅ All icons generated successfully!"
