# beartackler.github.io

A resume you have to uncover.

The page opens black with a single blinking cursor breathing rings of ASCII
haze into the dark, a sentence explaining what the cursor is for, and a button
that says `begin`. Press it — or click anywhere, or hit any key — and the
pointer drags a lantern across the grid: halftone at the fringe, readable type
at the core, resolving a word at a time. Dwell and it burns in permanently;
sweep past and it fades. Leave it alone and the page starts reading itself. A
readout in the corner tracks how much you've uncovered.

The button is there because the version without it taught the mechanic only to
people who sat perfectly still. The pulse ring demonstrated what the cursor
does, and a line of type offered to explain it after three seconds of
stillness — but the first thing anyone does on a new page is move the mouse,
and moving the mouse was what dismissed both. So it asks first and waits, with
the ring still breathing behind the panel: the demonstration and the sentence
about it, on screen together, for as long as it takes to read.

Uncover the page and four rings — the ikigai diagram — draw themselves in the
middle of it. Sweeping the lantern along a ring burns that stretch in. One word
appears in the middle of the screen: `scroll`, in a pocket of dark knocked out
of the haze, bright for eight seconds and then permanently quieter. It is the
only thing on the page saying there is more, so it has to be seen; it is also
the last thing someone reading the resume wants blinking at them, so it stands
down on its own and stays a button you can press.

That is the way into a gallery of six slides. Each is an image made of
characters, with a line under it:

1. the ikigai mark and a plum branch — Musashi
2. the four rings unfolding into the Audi rings, and an R8 driving in with its
   exhaust alight — Andretti
3. a man under a boulder on a slope — Camus
4. a loaded bar, seen down its own length — Rollins
5. a robot holding the last plant on Earth, in a boot — Wall·E
6. an empty portrait frame — Wilde

Then the way out: the blinking block the page opened with, alone in the dark
again, over an email address and two links. Six drawings used to end in an
empty black page — the visitor who scrolled the whole way, by definition the
most engaged one the page gets, arrived at nothing with the counter still
insisting there were six of six, and two thousand pixels of scrolling between
them and a way to get in touch.

The order is an argument rather than a playlist: purpose, then speed, then the
labour underneath it, then the honesty of that labour, then living rather than
surviving, and finally the mirror. Every line is quoted from a primary source
and dated; where provenance runs only to quote aggregators the line does not
get used, which is why the bodybuilding slide is Rollins in *Details* in 1994
and not a physique influencer.

There were eight. A wrestling ring and Pandora's jar were cut, not because the
quotes were weak but because neither picture ever became the thing it was of: a
ring is furniture, and furniture drawn accurately is furniture.

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

Nobody is trapped in the game. The opening panel offers `reveal it all` beside
`begin`, `space` lights the whole thing while anything is still hidden,
`?reveal` skips straight to it, `resume` is the PDF — the chrome sits above the
panel and stays clickable throughout, so someone who came for the PDF never has
to answer a question first — and the full resume, with every one of the six
lines and its attribution, is in the DOM at all times for screen readers,
crawlers and `noscript`.

Everything on the page a mouse can click, a keyboard can reach. The resume's
links are invisible boxes over the canvas and used to be out of the tab order,
on the grounds that `#doc` exposes every one of them — which is true for a
screen reader, whose reading cursor does not use the tab order, and false for
anyone sighted navigating by keyboard, because they cannot see `#doc`. That
left the email address on this page reachable only with a mouse. Focus now
does what hover does and points the lantern at the word as well, because
tabbing to a link in act one has to uncover it.

The opening panel and the scroll nudge stay hidden from the accessibility tree
and out of the tab order, and neither is an ARIA dialog: a screen reader should
get the resume, not a modal about a cursor trick it cannot use, and a keyboard
gets the same escapes by other means since any key dismisses the panel. The
sign-off at the end is the opposite case — real links, announced, in the tab
order — and `visibility: hidden` takes the whole block out of both until the
scroll brings it in.

`space` reveals while anything is still hidden and pages the gallery once
nothing is, and the button in the corner says which of those it is doing. For a
while it said `reveal` the whole way down, so from the first slide to the last
the chrome advertised a control that did something else.

A deliberate downward flick of the wheel does the same thing as `space`. The
gallery unlocks at ninety per cent of the words, which is a reward and should
stay one, but until then the page is `overflow: hidden` — so someone enjoying
the lantern who decides they would like to see further down used to get
nothing at all: no movement, no hint, no explanation, and every reason to
conclude the page was broken or over. A scroll gesture on a page that cannot
scroll is about as clear a statement of "show me the rest" as a visitor can
make without a keyboard.

A touch screen has no cursor, so it gets the resume rather than the game: the
wordmark, the contacts, the PDF, then every role, degree and skill, stacked in
the same type and scrolling. The lantern and the gallery really are
desktop-only, and for a long time the phone said so in four lines and handed
over a PDF link — which meant a recruiter reading on the train got a name, a
download, and none of the work. The note about the desktop is still there. It
is at the bottom now, where an aside goes.

Type on a phone is sized by what the wordmark needs — MONASYPOV as block type
is fifty-four columns — and then the page scrolls, rather than the cell
shrinking until the whole composition fits a screen it was never going to fit.
A layout that is going to scroll anyway has no business shrinking its type to
fit a height.

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
  takes the same fraction of a scroll gesture on any screen. Seven scenes, six
  slides: the outro is in the running order but not in the count, because the
  counter promises "n of six" and the outro is the page saying that was all of
  them. Its opacity is driven from the scroll position rather than by a CSS
  transition on a class, like everything else here — a time-based fade would be
  the one thing on the page still moving after the scroll had stopped.
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

  Of fifty-one traced panels, fifteen are drawn. At about 120 cells the drawing
  resamples at seven reference pixels per cell, so most of its line work is
  sub-cell and adds an even grey texture that eats the silhouette; twenty of the
  ones left out are rear-wheel spokes, which all arrive as the same grey disc.
  The one that matters most is the flank: its *boundary* is the whole interior
  drawing at once — both arches, the shoulder line, the sill, the leading edge
  of the sideblade. An earlier pass discarded it on the grounds that the outline
  of the biggest region must be the silhouette drawn twice, which is exactly
  wrong, because the silhouette runs along the ground under the tyres and this
  one runs around the arches.

  Tone across those fifteen is a depth order, not a lighting model. Glass, the
  lamps and the sideblade sit at the top of the ramp; panel seams sit in the
  middle; the shut lines under the sill sit low enough to be texture. Four of
  them are long and only two cells deep — a panel that thin cannot be drawn as
  an outline, because eroding it by a cell leaves nothing — so each arrives as a
  solid bar the length of the car, and given the sideblade's weight they turn
  the elevation into a barcode.

  It drives in. Position eases out across almost the whole entrance so the car
  is still visibly moving two-thirds of the way through and spends the last
  stretch settling the final few cells; opacity runs on its own ramp, slightly
  ahead, so it is materialising while it is still crossing. The exponent matters
  more than it looks — at a quartic the car is 98% home by the halfway point and
  the entrance reads as a fade again, which is the thing being fixed.
- **`src/slides/gallery.ts`** — the other four. Four rules run through all of
  them, all learned by getting them wrong:

  **Erase before you outline.** Every solid mass takes its own cells back to
  black first and is then drawn as line work, so overlapping parts have real
  edges. This is the single change that made the later slides legible. Two
  bright shapes touching on a grid this coarse are one shape — Sisyphus welded
  to the rim of his own boulder, three plates smeared into one thick coin — and
  there is no tone that separates them, because tone picks the glyph. Drawing
  the front shape's silhouette at tone *zero*, a shade wider, punches a hole in
  what is behind it. A black-figure pot gets the same effect for free by
  painting the man in the other colour.

  **People are drawn as solid silhouettes, never as stick figures.** A limb at
  this size is one cell wide, and three parallel one-cell lines beside the rim
  of a stone arrive as gravel. Sisyphus is a drawn torso profile, a head and
  eight tapered limb segments, filled bright and then cut into four times.

  **Nothing is filled except people.** A dim fill still puts a character in
  every cell, and two thousand of them is a wall, not a shadow. The boulder is
  the exception that proves it: a dark mass, a lit crescent, and fifty short
  arcs following its curvature. Concentric is the whole trick — marks that run
  *around* a sphere describe one, and the same marks scattered at random
  describe a disc with dirt on it.

  **Every picture has something in the empty part of it.** The slide that
  already worked is the one with a plum branch shedding petals across the whole
  frame, and most of what it had that the others lacked was air with something
  in it: a hill with nothing on it is a diagonal line, and a hill with scree on
  it is a hill. So there is chalk over the bar, grit under Wall·E, dust in
  Dorian's empty room, and rays across Sisyphus' sky.

  Three slides are worth their own note.

  Sisyphus took three passes and each one failed differently. Traced from a
  silhouette he came back as a single blob, because a silhouette of a man, a
  boulder and a slope is one connected black region. Built from straight
  tapered limbs he came back as a mannequin: a two-width taper is a cone, and a
  figure assembled from cones has no concave stretch anywhere on it. Real
  silhouettes are runs of bulges with hollows between them, and the hollows are
  the part that reads — a calf is widest a third of the way down and then
  closes to an ankle a third its width, and that one inward curve does more for
  "this is a person" than any amount of interior line work. So limbs are
  sampled at five widths along the bone and the sides run through all of them.

  The third failure was arithmetic. Joints were drawn with `circle()`, whose
  second argument is the segment count and not a second radius — so every joint
  was a true circle at the radius given, a thirty-unit ball at the hip and a
  twenty-four at the knee. Six round cells at a knee is not a knee, and eight
  of them down one figure is why he read as convex everywhere.

  He is also side-on, which rules out the obvious way to draw a strong man.
  There is no shoulder span to show from the side; in profile the mass is all
  depth. Trapezius from the skull to the point of the shoulder, a chest that
  stands out in front of the arm, a lat that flares behind the armpit and cuts
  in hard at the waist. Thirteen cells of chest over eight of waist, which is
  as much V as a character grid will hold. The near arm gets a reserved line —
  its own outline drawn at tone zero one cell wide, immediately before it is
  filled — because it crosses a chest at the same tone as itself, and the ramp's
  top rung is wide enough that an arm has to fall to 0.85 before it changes
  glyph at all, by which point the nearest limb on the figure is dimmer than
  his back.

  Wall·E was traced from a pen sketch three times before being built by hand,
  and the failure is instructive: a hatched drawing is tonally almost uniform —
  its information is in edges, not values — so posterising it returns one
  textured lump at every setting. Assembled from boxes it failed four more
  times, always the same way: recognisably a robot, recognisably not Wall·E.
  What identifies him is a short list and none of it is the box. Two binocular
  eyes on a yoke, cantilevered forward on a thin neck; treads that splay wider
  than the body; and the fact that he is holding something up. Each eye is a
  bright housing round an *erased* lens with one pupil in it — a bright disc
  with a ring round it is a headlamp — and an iris ring as well is true to the
  design and lands against the housing at thirteen cells across.

  Two things then had to be taken *out* of him. The proportion was wrong in the
  way that matters: he had a head wider than his own body, which is a
  bobblehead, so the body got wider and the eyes smaller. And the front face
  carried a lid seam, a hatch, a badge plate and three louvres — all true to
  the sketch, and together with the body's own top and bottom edges that is
  five horizontal rules inside twenty rows, which is a barcode. One hatch
  survives. The same arithmetic retired the treads' track links: eight pairs of
  ticks inside three rows resolve as a solid bar the length of the tread, which
  is a girder rather than a track.

  The bar is seen down its own length. Square to the page a barbell is two
  circles and a rule: symmetric, centred and completely inert, which is a
  strange thing for a picture whose subject is effort. From one end it is a
  diagonal, with a stack as tall as the frame in the near corner and three much
  smaller plates at the far end. The foreshortening is set by what has to fit
  inside a plate rather than by the geometry — a hard three-quarter view is a
  far more convincing disc, and thirteen cells across, which is not enough room
  for a rim, a lip, a hub and six grip holes.

  One thing on the page is deliberately alive during a hold: the sprout in
  Wall·E's boot leans about two degrees either way over eleven seconds, under a
  line about the difference between surviving and living. `Art.live` regenerates
  those few shapes each frame; everything load-bearing stays static, so a still
  capture of the hold is indistinguishable from any other.
- **`src/flame.ts`** — the exhaust plume.
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

One layout for all six slides, picture centred and line underneath. The
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

`node --import ./tools/reg.mjs tools/ascii.mjs walle 130` prints a slide as
text, straight from the real renderer — the loader hook is only there so node
can import the TypeScript sources directly. `car.html` shows the finished thing
in colour and the real font; this shows the characters, and for drawing work the
characters are what matters. "Is this a barbell" is answerable from a glyph grid
and is not really answerable from a nine-hundred-pixel screenshot of one.

`banner.html` renders `public/linkedin-banner.png` (1584 × 396) from the page's
own parts — the same glyph atlas, block face, mark geometry and palette tokens,
composed for a 4:1 strip, so it cannot drift from the site's style. It is a dev
entry only; Vite builds `index.html` and nothing else. Run `npm run dev`, open
`/banner.html`, and screenshot the canvas.

Type is [Departure Mono](https://departuremono.com) by Helena Zhang.
