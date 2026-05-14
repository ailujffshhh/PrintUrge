# PrintUrge Redesign Brand Spec — "Premium Tech"

## Visual Direction
An evolution of the PrintUrge brand that moves away from "generic student utility" towards a "premium, software-native printing platform". 

## Color Palette (OKLch)
We use a deep, sophisticated navy as the foundation, with high-contrast functional accents.

- `--bg`:      oklch(15% 0.02 250)    /* Deepest Navy/Midnight */
- `--surface`: oklch(22% 0.03 250)    /* Elevated Surface */
- `--fg`:      oklch(98% 0.01 250)    /* Near White */
- `--muted`:   oklch(65% 0.02 250)    /* Soft Slate */
- `--border`:  oklch(30% 0.04 250)    /* Subtle Hairline */
- `--accent`:  oklch(75% 0.18 200)    /* Electric Cyan (The primary action) */
- `--accent-alt`: oklch(70% 0.15 40)  /* Refined Orange (Secondary signal) */

## Typography
- **Display**: "Sora", system-ui, sans-serif (Keep the modern, geometric look).
- **Body**: "Inter", -apple-system, system-ui, sans-serif (Sleek, highly readable).
- **Mono**: "JetBrains Mono", monospace (For IDs, tokens, and "tech" moments).

## Posture & Layout
- **Glassmorphism**: Use `backdrop-filter: blur(20px)` for the header and floating cards.
- **Grids**: Subtle background grid (100px or 50px) to reinforce the "utility/engineering" vibe.
- **Radii**: Smooth 16px–24px corners for cards, but tighter 8px for internal controls.
- **Animations**: 
  - **Entrance**: Staggered fade-up for hero components.
  - **Transitions**: View Transitions API for seamless movement between landing and service pages.
  - **Micro**: Interactive hover states with slight scaling and glow effects on `--accent`.

## Dead Space Strategy
- Fill "empty" hero/section backgrounds with subtle animated mesh gradients or glowing "blobs" that move slowly.
- Use large, high-quality "blueprint" or "technical" style illustrations of printing mechanisms/outputs.
