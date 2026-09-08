# beartackler.github.io

A resume you have to uncover.

The page opens black with a single blinking cursor. Moving the pointer drags a
lantern across a monospace character grid: the fringe of the light is halftone
ASCII, the core resolves into readable type. Dwell somewhere and it burns in
permanently; sweep past and it fades in a few seconds. A readout in the corner
tracks how much you've uncovered.

Nobody is trapped in the game. `space` lights the whole thing, `p` swaps to a
properly typeset document, and the full resume is in the DOM at all times for
screen readers, crawlers and `noscript`.

## How it works

The whole page is one `<canvas>` character grid, roughly 160 × 58 cells.

- **`src/resume.json`** — every word on the page. `vite.config.ts` reads the same
  file at build time and bakes a semantic HTML resume into `index.html`, so the
  grid and the accessible document can never drift apart.
- **`src/layout.ts`** — composes the resume into cell coordinates. Two-column
  poster on desktop, stacked on narrow screens. Knows nothing about pixels.
- **`src/blockfont.ts`** — a 5-row bitmap face whose pixels are grid cells, so the
  display type is made of the same characters as the body text.
- **`src/field.ts`** — the lantern. `light` decays on a half-life, `ink` is what
  dwelling burned in, `lock` is the brief scramble as a cell resolves.
- **`src/atlas.ts`** — pre-renders every glyph once per colour. The density ramp is
  *measured* from the rendered glyphs rather than hardcoded, so it stays a true
  light-to-heavy scale. Punctuation only: letters in the fringe read as garbled
  words and fight the resolved type.
- **`src/render.ts`** — buckets cells by (sheet, quantised alpha) so a frame costs a
  few dozen context state changes instead of several thousand `fillText` calls.

Zero runtime dependencies. ~20 kB of JS, 8.5 kB gzipped.

## Accessibility

- Full resume in `<main>` at all times; the canvas is `aria-hidden`.
- Arrow keys drive the lantern; `space` reveals, `p` toggles plain, `r` resets.
- Focus never lands on something invisible — tabbing into the document switches
  the page to the readable view.
- `prefers-reduced-motion` opens fully revealed with no scramble.
- Print stylesheet renders a clean two-page resume.

## Develop

```sh
npm install
npm run dev
npm run build
```

Pushing to `main` deploys via GitHub Actions.

Type is [Departure Mono](https://departuremono.com) by Helena Zhang.
