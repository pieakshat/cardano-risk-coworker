# Design: Cardano Risk Analyst

Locked Hallmark catalog system for a modern-minimal risk instrument.

## System

- Genre: modern-minimal
- Macrostructure: Workbench
- Theme: Cobalt
- Axes: cool light paper / grotesk sans / electric cobalt
- Navigation: N1b bordered product bar
- Footer: Ft1 compact colophon

## Tokens

The source of truth is `app/tokens.css`.

- Paper: `oklch(98.5% 0.004 250)` and cool paper steps
- Ink: `oklch(24% 0.02 258)` with a softer body ink
- Accent: `oklch(58% 0.20 256)` only for action and state
- Display: Space Grotesk
- Body: Inter
- Code: JetBrains Mono
- Radius: 6px controls, 10px evidence surfaces

## Composition

Use ruled borders and asymmetry to make the evidence feel inspectable. The
first screen starts with one token action and a live-looking readout. A result
must lead with the verdict and one biggest red flag, then expose evidence and
source calls. Avoid card grids, invented metrics, gradients, and decorative
icons.

## Motion

Motion is cut except for small interaction transitions. Reduced motion removes
transitions entirely.
