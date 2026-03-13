# Contributing to Transcribely

## Versioning Rules

Every merge to `main` **must** include a version bump in `package.json`:

- **Patch** (x.x.X): Bug fixes, small tweaks, skill text changes
- **Minor** (x.X.0): New features, new tools, new UI components  
- **Major** (X.0.0): Major capabilities (agentic features, design overhauls, architecture changes)

## Branch Workflow

1. Create a feature branch: `feature/<name>`
2. Make changes, commit with conventional commit messages (`feat:`, `fix:`, `refactor:`)
3. Run `npm test` — ensure no new test failures vs baseline
4. Bump version in `package.json` per the rules above
5. Merge to `main` and push
