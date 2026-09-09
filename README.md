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

That is the way into a gallery of six slides. Each one is an image made of
characters and a line set beside it:

1. the ikigai mark and a plum branch — Musashi
2. the four rings unfolding into the Audi rings, and an R8 with its exhaust
   alight — Andretti
3. a boulder, a slope, a man — Camus
4. a jar with everything already out of it — Hesiod
5. a robot holding the last plant on Earth — Wall·E
6. an empty portrait frame — Wilde

The rings and the Audi badge are the same four circles, one arranged as a
diamond and one as a row, so that change is an interpolation of centres rather
than a dissolve — nothing appears or disappears, and the two marks turn out to
have been the same object.

**Every slide holds.** Each scene owns three beats — enter, hold, exit — and
nothing driven by scroll changes during the hold. That is not a detail; it is
the whole structure. The page used to be one continuous morph, and its finished
compositions lasted about a twentieth of the scroll each: less time than their
own 1.4-second fade, so at any real scrolling speed you never once saw the
thing it had spent a viewport and a half assembling.

Every part of it is a pure function of scroll position, so scrolling back up
puts the resume back exactly as it was, mark and all. The journey follows the
scroll with a spring rather than tracking it directly: a wheel notch is a jump,
and the mark is rasterised to whole cells, so tracking `scrollY` made it
advance in visible steps. `space` pages between slides, landing in the middle
of each hold — the one place in the timeline guaranteed to be a finished
composition.

Nobody is trapped in the game. `space` lights the whole thing while anything is
still hidden, `resume` is the PDF, and the full resume — with every one of the
six lines and its attribution — is in the DOM at all times for screen readers,
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
- **`src/scenes.ts`** — the timeline. Beats are measured in viewports, so a slide
  takes the same fraction of a scroll gesture on any screen.
- **`src/art.ts`** — one renderer for every drawn thing: filled polygons and
  stroked polylines, scanline-rasterised with subsampled coverage and resolved
  through the same measured density ramp as the haze. Six slides drawn six ways
  would look like six projects. Stroke widths are given in *cells*, not artwork
  pixels — a line thinner than a cell is not a line, it is a fraction of
  coverage that the compositor dilutes into whatever it is drawn over.
- **`src/slides/r8.ts`** — the car, traced from a dimensioned CAD side elevation
  rather than modelled. The drawing is 949 × 269, aspect 3.528; a real R8 is
  4431 × 1252 mm, aspect 3.539 — within 0.3%, so tracing it gives proportions
  that are correct rather than plausible. `tools/fidelity.mjs` scores the result
  against the source at 97.5% intersection-over-union. It is drawn as line work,
  not shaded tone: on a black page a black tyre and near-black glass are not
  dark details, they are the background, and the first attempt produced a car
  with no wheels.
- **`src/flame.ts`** — the exhaust plume, and the one out of Pandora's jar. Same
  code, turned upright.
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

`public/favicon.svg` is the mark reduced for a 16px tab. Drawn straight, four
overlapping rings leave eight dark holes in the middle and read as a grille at
that size, so the heavy stroke is the *union* outline — union(r) minus an inset
copy, which keeps only the silhouette of all four rings as one continuous line.
The real diagram sits underneath as thin, opaque rings rather than thick, faint
ones: stroke width is what falls below a pixel as the icon shrinks, so the
construction is invisible at 16px and crisp at 180px. `apple-touch-icon.png` is
the same geometry with more padding, since iOS masks it to a squircle.

Zero runtime dependencies. ~43 kB of JS, 18.3 kB gzipped. 8.3 ms median frame
with the page fully lit, and the same through all three acts — the car is
rasterised into cells, and there are only about a thousand triangles.

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

Act three adds no fourth colour. Exhaust flames on a real V10 are violet-white
rather than orange, because what is burning is unburnt fuel lighting off in the
pipe, so the fire is already the plum act two established — the same hue doing
a different job. Its core is bone rather than white-hot for the same reason the
whole page is: against a black night a white core is the hottest part of a
flame, but against a bone-white car it is invisible.

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

`car.html` is a contact sheet of the R8 at a spread of angles, rendered through
the real atlas and the real ramp, with `?m=lum` for raw shading and `?m=mat`
for materials. Judging a mesh through an ASCII ramp confuses two questions at
once; those two modes separate them.

`banner.html` renders `public/linkedin-banner.png` (1584 × 396) from the page's
own parts — the same glyph atlas, block face, mark geometry and palette tokens,
composed for a 4:1 strip, so it cannot drift from the site's style. It is a dev
entry only; Vite builds `index.html` and nothing else. Run `npm run dev`, open
`/banner.html`, and screenshot the canvas.

Type is [Departure Mono](https://departuremono.com) by Helena Zhang.
