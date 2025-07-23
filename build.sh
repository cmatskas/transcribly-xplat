#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print section headers
print_header() {
    echo -e "\n${BLUE}=== $1 ===${NC}\n"
}

# Clean up
print_header "Cleaning previous builds"
rm -rf ./dist/*

# Create directory structure
print_header "Creating directory structure"
mkdir -p ./dist/releases/{windows,macos}

# Build Windows x64
print_header "Building Windows x64"
npm run build:win -- --x64
mv ./dist/temp/Transcribely-Setup-x64.exe ./dist/releases/windows/

# Build Windows ARM64
print_header "Building Windows ARM64"
npm run build:win -- --arm64
mv ./dist/temp/Transcribely-Setup-arm64.exe ./dist/releases/windows/

# Build macOS Universal
print_header "Building macOS Universal"
npm run build:mac -- --universal
mv ./dist/temp/Transcribely-*-universal.dmg ./dist/releases/macos/

# Clean up temporary files
print_header "Cleaning up"
rm -rf ./dist/temp

# List final artifacts
print_header "Build Artifacts"
echo -e "${GREEN}Windows Installers:${NC}"
ls -lh ./dist/releases/windows/
echo -e "\n${GREEN}macOS Installers:${NC}"
ls -lh ./dist/releases/macos/

print_header "Build Complete"
echo "Installers are available in ./dist/releases/"
