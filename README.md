# beartackler.github.io

A resume you have to uncover.

The page opens black with a single blinking cursor breathing rings of ASCII
haze into the dark — the resume shows up only as the gaps those rings leave.
Moving the pointer drags a lantern across the grid: halftone at the fringe,
readable type at the core, resolving a word at a time. Dwell and it burns in
permanently; sweep past and it fades. Leave it alone and the page starts
reading itself. A readout in the corner tracks how much you've uncovered.

Uncover it all by hand and four rings — the ikigai diagram — draw themselves
through the page's empty cells, big enough that the resume ends up sitting
inside the mark. Sweeping the lantern along a ring burns that stretch in.
Pressing `reveal` gets you the resume, which is what `reveal` is for, but it
does not get you this.

Nobody is trapped in the game. `space` lights the whole thing, `resume` is the
PDF, and the full resume is in the DOM at all times for screen readers,
crawlers and `noscript`.

## How it works

The whole page is one `<canvas>` character grid, roughly 160 × 58 cells.

- **`src/resume.json`** — every word on the page. `vite.config.ts` reads the same
  file at build time and bakes a semantic HTML resume into `index.html`, so the
  grid and the accessible document can never drift apart.
- **`src/layout.ts`** — composes the resume into cell coordinates. Two-column
  poster on desktop, stacked on narrow screens. Knows nothing about pixels.
  The plane is padded past the composition so the lantern can light the screen
  edges, and keeps the bottom clear of the fixed controls.
- **`src/mark.ts`** — the four rings, laid out through cells at least two
  columns clear of any character, so every arc breaks cleanly around type.
- **`src/blockfont.ts`** — a 5-row bitmap face whose pixels are grid cells, so the
  display type is made of the same characters as the body text.
- **`src/field.ts`** — the lantern. `light` decays on a half-life, `ink` is what
  dwelling burned in. Per-cell light is rolled up to per-*word* light, so type
  snaps into focus whole rather than shearing through the middle of the beam.
  `ring()` drives the cold open and skips text cells outright, which makes
  spoiling a word structurally impossible rather than a matter of tuning.
- **`src/atlas.ts`** — pre-renders every glyph once per colour. The density ramp is
  *measured* from the rendered glyphs rather than hardcoded, so it stays a true
  light-to-heavy scale. Punctuation only: letters in the fringe read as garbled
  words and fight the resolved type.
- **`src/render.ts`** — buckets cells by (sheet, quantised alpha) so a frame costs a
  few dozen context state changes instead of several thousand `fillText` calls.

`public/og.png` is a share card rendered from the page itself, so a link
preview shows the real thing.

Zero runtime dependencies. ~25 kB of JS, 10.6 kB gzipped.

## Accessibility

- Full resume in `<main>` at all times; the canvas is `aria-hidden`. Its links
  are removed from the tab order, since focus must never land on something
  invisible; assistive tech reaches them through its own reading cursor.
- The poster is sized to fit the viewport in both axes, so the page does not
  scroll. Only a screen too small even at a 4px cell falls back to scrolling.
- The controls are lit by the lantern, so bringing it near the corner surfaces
  them; they also surface on their own for anyone stuck after fifteen seconds.
- Arrow keys drive the lantern; `space` reveals, `r` resets.
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
