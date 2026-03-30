---
inclusion: always
---
# Transcribely Project Conventions

1. **Release notes** — All changelog entries go in `RELEASE_NOTES.md`, never in `README.md`.
2. **README updates** — Update `README.md` (features list, version references) when making a significant commit with meaningful changes.
3. **Version bump** — Always bump the version (`npm version patch/minor/major --no-git-tag-version`) before committing and pushing. Bug fixes = patch, new features = minor, breaking changes = major.
4. **Distributables** — When building distributables, always build all three without asking:
   - macOS Universal DMG (`npm run build:mac`)
   - Windows x64 (`npx electron-builder --win --x64`)
   - Windows ARM64 (`npm run build:win`)
