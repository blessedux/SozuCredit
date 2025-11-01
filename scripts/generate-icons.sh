#!/bin/bash

# Generate PWA icons from a base icon
# Place your base icon (1024x1024 or larger PNG) as icon-base.png in the public/icons directory

BASE_ICON="public/icons/icon-base.png"
OUTPUT_DIR="public/icons"

# Create icons directory if it doesn't exist
mkdir -p $OUTPUT_DIR

# Check if base icon exists
if [ ! -f "$BASE_ICON" ]; then
    echo "Error: Base icon not found at $BASE_ICON"
    echo "Please create a 1024x1024 PNG icon and save it as icon-base.png in the public/icons directory"
    exit 1
fi

# Required icon sizes for PWA
sizes=(72 96 128 144 152 192 384 512)

echo "Generating PWA icons..."

for size in "${sizes[@]}"; do
    output_file="$OUTPUT_DIR/icon-${size}x${size}.png"
    
    # Use sips (macOS) or ImageMagick convert
    if command -v sips &> /dev/null; then
        sips -z $size $size "$BASE_ICON" --out "$output_file"
    elif command -v convert &> /dev/null; then
        convert "$BASE_ICON" -resize ${size}x${size} "$output_file"
    else
        echo "Error: Neither sips nor ImageMagick found. Please install one of them."
        exit 1
    fi
    
    echo "✓ Generated $output_file"
done

echo "All icons generated successfully!"

