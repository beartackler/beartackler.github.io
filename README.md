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

That is the way into a gallery of eight slides. Each is an image made of
characters, with a line under it:

1. the ikigai mark and a plum branch — Musashi
2. the four rings unfolding into the Audi rings, and an R8 with its exhaust
   alight — Andretti
3. a boulder, a slope, a man — Camus
4. a loaded bar on the floor — Rollins
5. a ring under a hard light — Barthes
6. a jar with everything already out of it — Hesiod
7. a robot holding the last plant on Earth — Wall·E
8. an empty portrait frame — Wilde

The order is an argument rather than a playlist: purpose, then speed, then the
labour underneath it, then the honesty of that labour, then the audience
watching, then what gets let out, then living rather than surviving, and
finally the mirror. Every line is quoted from a primary source and dated; where
provenance runs only to quote aggregators the line does not get used, which is
why the bodybuilding slide is Rollins in *Details* in 1994 and not a physique
influencer.

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
eight lines and its attribution — is in the DOM at all times for screen readers,
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
  would look like six projects. Three details carry most of the quality:

  - Stroke widths are given in *cells*, not artwork pixels. A line thinner than
    a cell is not a line, it is a fraction of coverage that the compositor
    dilutes into whatever it is drawn over.
  - A stroke is *sharpened* after rasterising, and a line cell is then resolved
    from its tone alone. A one-cell line rarely lands squarely inside a cell, so
    its coverage comes out around a half — and half coverage times full tone
    lands on a sparse glyph on a dim sheet. Drawn that way the R8's wheels were
    in the buffer and invisible on the page. Coverage decides only *whether* a
    line lights a cell. Resolving one from coverage instead, which is where that
    fix first landed, costs a drawing all its depth: every line comes out at the
    same weight and a dim one differs only in colour, so a far rope reads as
    near. Fills still resolve from tone times coverage, because thinning out is
    what less of a *region* looks like.
  - The drawings resolve through their own eight-mark ramp, `. : - = + * # @`,
    rather than the atlas's measured one. The measured ramp is ordered purely by
    how much ink a glyph puts in a cell, which is right for haze — variety is
    the point there — but its middle is `\\ / < > ~ { }`, and a line drawn in
    those does not read as a fainter line, it reads as scratches and chain
    links.
  - `edge` fills a path and keeps only the boundary of what got filled, and
    `edge: 'outer'` keeps only the boundary against a flood from outside. A
    traced contour cannot be stroked: marching squares walks one continuous
    loop through every detached component, so the path doubles back constantly
    — under an even-odd fill those excursions cancel, stroked they all draw,
    and the car's silhouette came out as a hedge. Both take a width, and the
    boundary is grown inward so a heavier line never makes the thing it outlines
    any bigger.
  - `specks` lights exactly one cell per point, unsmoothed. Scree on a hill,
    chalk in the air, a crowd in the dark. `hue: 'plum'` moves a shape onto act
    two's sheets — a lamp, a sprout, a sun.
- **`src/slides/r8.ts`** — the car, traced from a dimensioned CAD side elevation
  rather than modelled. The drawing is 955 × 275, aspect 3.47; a real R8 is
  4431 × 1252 mm, aspect 3.539 — within 2%, so tracing it gives proportions that
  are correct rather than plausible. It is drawn as line work, not shaded tone:
  on a black page a black tyre and near-black glass are not dark details, they
  are the background, and the first attempt produced a car with no wheels. The
  second filled the body dim instead, which is worse in a subtler way — tone
  picks the glyph, not the opacity, so a dim flank is still a fully opaque
  character in every one of two thousand cells and the car arrives as a grey
  brick with a car-shaped edge.

  Of fifty-one traced panels, seven are drawn. At about 120 cells the drawing
  resamples at seven reference pixels per cell, so most of its line work is
  sub-cell and adds an even grey texture that eats the silhouette. The one that
  matters most is the flank: its *boundary* is the whole interior drawing at
  once — both arches, the shoulder line, the sill, the leading edge of the
  sideblade. An earlier pass discarded it on the grounds that the outline of the
  biggest region must be the silhouette drawn twice, which is exactly wrong,
  because the silhouette runs along the ground under the tyres and this one runs
  around the arches.
- **`src/slides/gallery.ts`** — the other six. Two rules run through all of
  them, both learned by getting them wrong:

  People are drawn as solid silhouettes, never as stick figures. A limb at this
  size is one cell wide, and three parallel one-cell lines beside the rim of a
  stone — or behind three ropes — arrive as gravel.

  Every picture has something in the empty part of it. The slide that already
  worked is the one with a plum branch shedding petals across the whole frame,
  and most of what it had that the others lacked was air with something in it: a
  hill with nothing on it is a diagonal line, and a hill with scree on it is a
  hill. So there is chalk over the bar, dust in Dorian's empty room, grit and
  tyre smoke under the R8, a crowd in the dark around the ring, and motes in the
  light above it.

  Nothing is filled except people: a dim fill still puts a character in every
  cell, and two thousand of them is a wall, not a shadow.

  The wrestling slide took four goes. A championship belt hung in the V a real
  one hangs in came out as a moth. A square-on elevation of a ring came out as a
  lamp over a table, and so did the same ring in three-quarter perspective —
  because a ring is furniture, and furniture drawn accurately is furniture. What
  works is one corner post at the edge of the frame, three ropes running out of
  it, and two men in the middle: the subject is not the object, it is what is
  happening on it.
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

Zero runtime dependencies. ~57 kB of JS, 23.8 kB gzipped, of which 7 kB is the
car's path data. 8.3 ms median frame with the page fully lit and the same
through the whole gallery.

Everything that is text is positioned off the *plane* rather than off the screen
edges. The scroll cue hangs on the mark's own column; act two's line is ranged
right against the mark at its final height; each slide's line is centred under
its picture, against the picture's own lower edge rather than against the
viewport, and the picture's height is solved before it is fitted so that the two
cannot disagree on a short window. Anything positioned off a viewport corner
reads as chrome. The cue is drawn with the same density ramp as the rule under
the name, for the same reason — a 1px CSS rule would be the only thing on the
page not made of characters.

One layout for all eight slides, picture centred and line underneath. The
obvious alternative — caption beside a portrait, caption below a landscape,
which is the ordinary rule for captions — reads on a canvas as two layouts
rather than one, and forces every portrait picture down to less than half the
width so that the column exists at all.

## Colour

Act one is black, bone and a safelight amber. Act two is black, bone and plum,
and the amber is gone before the plum arrives — the fade finishes at 32% of the
scroll and the branch does not start growing until 26%.

The gallery adds no fourth colour. Exhaust flames on a real V10 are violet-white
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

`car.html` renders any slide's artwork at a chosen size through the real atlas
and the real ramp, so what is judged there is what the page will draw:
`?art=walle` picks a scene by id, `?w=90` forces a width in cells, `?only=3-9`
draws a slice of the shape list for bisecting, and `?m=tone` shows raw alpha
with no ramp.

`tools/trace.mjs` turns a line drawing into path data — marching squares over a
flood-filled mask, then Douglas–Peucker — and `tools/fidelity.mjs` scores the
result against the drawing's own filled silhouette and prints a map of where the
two disagree, so "1:1 with the real car" is a number rather than an opinion. The
R8's outline scores 88.7% IoU while losing only 27 cells of 9377: the shortfall
is all the other way and all deliberate, because the silhouette is traced with a
three-pixel closing. Without it the front grille defeats the trace — its slats
are loose strokes with air between them, so a flood from outside walks into the
nose and the contour goes around all ten of them, and the car arrives with a
dotted bumper.

`banner.html` renders `public/linkedin-banner.png` (1584 × 396) from the page's
own parts — the same glyph atlas, block face, mark geometry and palette tokens,
composed for a 4:1 strip, so it cannot drift from the site's style. It is a dev
entry only; Vite builds `index.html` and nothing else. Run `npm run dev`, open
`/banner.html`, and screenshot the canvas.

Type is [Departure Mono](https://departuremono.com) by Helena Zhang.
