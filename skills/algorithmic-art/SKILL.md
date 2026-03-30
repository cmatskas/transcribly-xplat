---
name: algorithmic-art
description: "Creating algorithmic art using p5.js with seeded randomness and interactive parameter exploration. Use when users request generative art, algorithmic art, flow fields, particle systems, or code-based visual art."
metadata:
  provider: adapted-anthropic
  version: "1.0"
  license: "See original at github.com/anthropics/skills"
---

# Algorithmic Art Skill

Create original algorithmic art expressed through p5.js code. Output: a philosophy document (.md) and a self-contained interactive HTML viewer (.html).

## Two-Step Process

1. **Algorithmic Philosophy Creation** — define the generative aesthetic movement
2. **p5.js Implementation** — express it as interactive code

---

## STEP 1: ALGORITHMIC PHILOSOPHY CREATION

Create an ALGORITHMIC PHILOSOPHY (not static images) interpreted through:
- Computational processes, emergent behavior, mathematical beauty
- Seeded randomness, noise fields, organic systems
- Particles, flows, fields, forces
- Parametric variation and controlled chaos

### How to Generate

**Name the movement** (1-2 words): "Organic Turbulence" / "Quantum Harmonics" / "Emergent Stillness"

**Articulate the philosophy** (4-6 paragraphs) expressing how it manifests through:
- Computational processes and mathematical relationships
- Noise functions and randomness patterns
- Particle behaviors and field dynamics
- Temporal evolution and system states
- Parametric variation and emergent complexity

### Guidelines
- Avoid redundancy — each algorithmic aspect mentioned once
- Emphasize craftsmanship — the algorithm should feel meticulously crafted, refined through deep expertise
- Leave creative space — be specific about direction but concise enough for interpretive implementation
- Beauty lives in the process, not the final frame

### Philosophy Examples

**"Organic Turbulence"**: Flow fields driven by layered Perlin noise. Thousands of particles following vector forces, trails accumulating into organic density maps. Color emerges from velocity and density.

**"Quantum Harmonics"**: Particles on a grid carrying phase values evolving through sine waves. Constructive interference creates bright nodes, destructive creates voids.

**"Recursive Whispers"**: Branching structures subdividing recursively. L-systems generating tree-like forms constrained by golden ratios. Subtle noise perturbations break perfect symmetry.

Output the philosophy as a .md file.

---

## STEP 2: P5.JS IMPLEMENTATION

### Technical Requirements

**Seeded Randomness (Art Blocks Pattern)**:
```javascript
let seed = 12345;
randomSeed(seed);
noiseSeed(seed);
```

**Parameters — follow the philosophy**:
```javascript
let params = {
  seed: 12345,
  // Define what YOUR algorithm needs:
  // Quantities, scales, probabilities, ratios, angles, thresholds
};
```

**Canvas Setup**:
```javascript
function setup() {
  createCanvas(1200, 1200);
}
function draw() {
  // Your generative algorithm
}
```

### Algorithm Design

Let the philosophy dictate the implementation:

- **Organic emergence** → elements that grow, accumulate, interact with feedback loops
- **Mathematical beauty** → geometric relationships, trigonometric harmonics, precise ratios
- **Controlled chaos** → random variation within strict boundaries, order from disorder

### Craftsmanship Requirements

- **Balance**: Complexity without visual noise
- **Color Harmony**: Thoughtful palettes, not random RGB
- **Composition**: Visual hierarchy even in randomness
- **Performance**: Smooth real-time execution
- **Reproducibility**: Same seed = identical output

---

## INTERACTIVE HTML ARTIFACT

Create a single self-contained HTML file with everything inline (p5.js from CDN).

### Structure

```html
<!DOCTYPE html>
<html>
<head>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/p5.min.js"></script>
  <style>/* Clean modern styling */</style>
</head>
<body>
  <div class="sidebar">
    <!-- Seed controls: display, prev/next/random/jump -->
    <!-- Parameter sliders -->
    <!-- Action buttons: regenerate, reset, download PNG -->
  </div>
  <div class="canvas-container">
    <!-- p5.js canvas renders here -->
  </div>
  <script>/* Complete p5.js algorithm inline */</script>
</body>
</html>
```

### UI Styling

Use a clean, modern, neutral design:
- **Fonts**: system font stack (`-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`)
- **Colors**: neutral dark sidebar (`#1a1a2e`), light canvas background, accent color `#3b82f6`
- **Layout**: sidebar (280px) + main canvas area
- **Controls**: clean sliders, subtle borders, readable labels

### Required Features

**Seed Navigation**:
- Display current seed
- Previous / Next / Random buttons
- Jump-to-seed input field

**Parameter Controls**:
- Sliders for numeric parameters (count, scale, speed, etc.)
- Color pickers for palette colors (if applicable)
- Real-time updates on change
- Reset to defaults button

**Actions**:
- Regenerate (re-run with current params)
- Reset (restore default params)
- Download PNG

### Output

1. **Algorithmic Philosophy** (.md) — the generative aesthetic manifesto
2. **Single HTML Artifact** — self-contained interactive generative art

The HTML works immediately in any browser — no server, no setup, no external dependencies beyond the p5.js CDN.
