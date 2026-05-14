# PrintUrge Redesign Brand Spec — "Editorial Minimal"

## Visual Direction
A high-end, magazine-inspired aesthetic ("Monocle" / "FT Weekend"). Focuses on precise typography, generous whitespace, and a tactile "paper-and-ink" feel. Moves away from software-native UI towards a boutique publishing posture.

## Color Palette (OKLch)
A warm, sophisticated foundation with deep ink typography.

- `--bg`:      oklch(98% 0.004 95)    /* Warm Paper */
- `--surface`: oklch(100% 0.002 95)   /* Pure Paper */
- `--fg`:      oklch(15% 0.01 70)     /* Deep Ink Black */
- `--muted`:   oklch(45% 0.015 70)    /* Faded Ink / Grey */
- `--border`:  oklch(90% 0.006 95)    /* Subtle Rule / Fold */
- `--accent`:  oklch(35% 0.05 40)     /* Deep Oxblood / Signature Ink (used sparingly) */

## Typography
- **Display**: "Charter", "Iowan Old Style", Georgia, serif (Elegant, high-contrast).
- **Body**: -apple-system, system-ui, sans-serif (Clean, functional for readability).
- **Mono**: ui-monospace, "IBM Plex Mono", monospace (For metadata, labels, and "issue" numbers).

## Posture & Layout
- **Grids**: Asymmetric "Swiss" style. One wide column for content, one narrow for metadata/labels.
- **Rules**: Use hair-thin horizontal rules (`0.5px` or `1px`) to separate sections, reminiscent of newspaper layouts.
- **Whitespace**: Extreme restraint. Let the paper breathe. No shadows, no gradients, no rounded corners.
- **Imagery**: High-quality, art-directed photography or line-art illustrations. No generic icons.
- **Animations**: 
  - **Fade-In**: Slow, fluid opacity transitions (0.8s - 1.2s).
  - **Parallax**: Very subtle vertical shift on images to suggest depth.
  - **Text Reveal**: Words or lines sliding up softly.

## Sections
- **The Brief**: A long-form editorial intro replaces the traditional "feature list".
- **The Services**: Rendered like an index or catalog page.
- **The Process**: Linear, numbered "step-by-step" with mono labels.
