# beartackler.github.io

A resume you have to uncover.

The page opens black with a single blinking cursor breathing rings of ASCII
haze into the dark — the resume shows up only as the gaps those rings leave.
Moving the pointer drags a lantern across the grid: halftone at the fringe,
readable type at the core, resolving a word at a time. Dwell and it burns in
permanently; sweep past and it fades. Leave it alone and the page starts
reading itself. A readout in the corner tracks how much you've uncovered.

Uncover the page and four rings — the ikigai diagram — draw themselves in the
middle of it. Sweeping the lantern along a ring burns that stretch in. One word
appears at the bottom of the screen: `scroll`.

That is the second act. Scrolling fades the resume out, carries the mark down
to the middle of the screen and grows it until it fills the page, and grows a
plum branch in across the top — black, bone white and plum, nothing else. The
counter in the corner stays, and switches from words uncovered to blossoms
open, so there is always something on screen saying how far this runs and that
it ends. When both have arrived, one line is set against the mark.

Every part of it is a pure function of scroll position, so scrolling back up
puts the resume back exactly as it was, mark and all. The journey follows the
scroll with a spring rather than tracking it directly: a wheel notch is a
jump, and the mark is rasterised to whole cells, so tracking `scrollY` made it
advance in visible steps.

Nobody is trapped in the game. `space` lights the whole thing, `resume` is the
PDF, and the full resume is in the DOM at all times for screen readers,
crawlers and `noscript`.

A touch screen has no cursor, so it gets a card instead of the page: the
wordmark, the rule, one line about what it is missing, and the two things a
visitor on a phone actually came for. Shrinking a cursor game onto a phone
produces something that works badly; saying so produces something that works.

## How it works

The whole page is one `<canvas>` character grid, roughly 160 × 58 cells.

- **`src/resume.json`** — every word on the page. `vite.config.ts` reads the same
  file at build time and bakes a semantic HTML resume into `index.html`, so the
  grid and the accessible document can never drift apart.
- **`src/layout.ts`** — composes the resume into cell coordinates. Two-column
  poster on desktop, stacked on narrow screens. Knows nothing about pixels.
  The plane is padded past the composition so the lantern can light the screen
  edges, and keeps the bottom clear of the fixed controls.
- **`src/mark.ts`** — the four rings, evaluated live so scroll can move and grow
  them. Three clearance modes: a generous halo around every character while the
  mark is at rest, hairline gaps while it travels through a page that is still
  legible, and nothing to respect once the resume has gone. The ring band
  feathers while the mark is in motion, so a cell fades in as an arc sweeps
  over it rather than appearing whole.
- **`src/blossom.ts`** — the plum branch, which also reports how many of its
  blossoms are open, because that is act two's progress readout. Generated once
  from a fixed seed, with every segment, flower and falling petal carrying the
  scroll position at which it appears, which is what makes the growth
  reversible. Amplitudes are fractions of the band it occupies rather than
  fixed row counts, so it fills the top of any viewport.
- **`src/blockfont.ts`** — a 5-row bitmap face whose pixels are grid cells, so the
  display type is made of the same characters as the body text.
- **`src/field.ts`** — the lantern. `light` decays on a half-life, `ink` is what
  dwelling burned in. Per-cell light is rolled up to per-*word* light, so type
  snaps into focus whole rather than shearing through the middle of the beam.
  A third channel, `floor`, carries the cold-open ring and the mark: it lights
  the material but is never read by the word resolver, so a ring can cross the
  whole screen as one unbroken line and still be structurally incapable of
  spoiling a word.
- **`src/atlas.ts`** — pre-renders every glyph once per colour. The density ramp is
  *measured* from the rendered glyphs rather than hardcoded, so it stays a true
  light-to-heavy scale. Punctuation only: letters in the fringe read as garbled
  words and fight the resolved type.
- **`src/render.ts`** — buckets cells by (sheet, quantised alpha) so a frame costs a
  few dozen context state changes instead of several thousand `fillText` calls.
  `fade` and `tint` are the whole of the second act's crossfade: the lantern's
  contribution is scaled by `fade` *before* anything is compared against it, so
  the mark can win cells the lantern already burned in. `fade` is skewed by row
  rather than applied flat, which turns a fade into a top-down wipe and stops
  the whole plane stepping through its alpha buckets in lockstep.

`public/og.png` is a share card rendered from the page itself, scrolled to the
end of the second act: a link preview is a thumbnail, and the branch and the
mark survive being shrunk in a way that a page of 9px type does not.

Zero runtime dependencies. ~32 kB of JS, 13.6 kB gzipped. 8.3 ms median frame
with the page fully lit, and the same through the second act.

The scroll cue and the closing line are both positioned off the *plane* rather
than off the screen edges: the cue hangs on the mark's own column, and the line
is ranged right against the mark at its final height. Anything positioned off a
viewport corner reads as chrome; anything positioned off the mark reads as
belonging to it. The cue is drawn with the same density ramp as the rule under
the name, for the same reason — a 1px CSS rule would be the only thing on the
page not made of characters.

## Colour

Act one is black, bone and a safelight amber. Act two is black, bone and plum,
and the amber is gone before the plum arrives — the fade finishes at 32% of the
scroll and the branch does not start growing until 26%.

The plum sits at OKLCH hue 357, most of the way round the wheel from the
safelight's 48. It started at hue 12, which was only 35 degrees off, and 35
degrees is the worst possible distance: too far to read as one colour and too
close to read as two, so the page looked like two oranges that didn't match.

## Accessibility

- Full resume in `<main>` at all times; the canvas is `aria-hidden`. Its links
  are removed from the tab order, since focus must never land on something
  invisible; assistive tech reaches them through its own reading cursor.
- The poster is sized to fit the viewport in both axes, so act one does not
  scroll and scrolling means the second act and nothing else. A screen too
  small even at a 4px cell scrolls to read the resume and is not offered the
  second act at all.
- The controls are lit by the lantern, so bringing it near the corner surfaces
  them; they also surface on their own for anyone stuck after fifteen seconds.
- Touch screens get the card, which is static, legible immediately, and carries
  the PDF and the contacts as real anchors.
- Arrow keys drive the lantern until there is a second act to scroll through,
  then they hand back to the browser. `space` reveals while anything is still
  hidden and pages through the second act once it is not. `r` resets to a black
  page.
- `prefers-reduced-motion` opens fully revealed with no scramble, and is handed
  the mark rather than made to earn it. The second act is driven by scroll
  position rather than by time, so it plays the same either way.
- Print stylesheet renders a clean two-page resume.

## Develop

```sh
npm install
npm run dev
npm run build
```

Pushing to `main` deploys via GitHub Actions.

`banner.html` renders `public/linkedin-banner.png` (1584 × 396) from the page's
own parts — the same glyph atlas, block face, mark geometry and palette tokens,
composed for a 4:1 strip, so it cannot drift from the site's style. It is a dev
entry only; Vite builds `index.html` and nothing else. Run `npm run dev`, open
`/banner.html`, and screenshot the canvas.

Type is [Departure Mono](https://departuremono.com) by Helena Zhang.
