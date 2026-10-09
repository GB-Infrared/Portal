```
        ███████ ███    ██ ███████ ██████   ██████  ██████  ███████
        ██      ████   ██ ██      ██   ██ ██    ██ ██   ██ ██
        █████   ██ ██  ██ █████   ██████  ██    ██ ██████  ███████
        ██      ██  ██ ██ ██      ██   ██ ██    ██ ██           ██
        ███████ ██   ████ ███████ ██   ██  ██████  ██      ███████

        O P E R A T I N G   S Y S T E M  ·  S I T E   C O N T R O L
        ─────────────────────────────────────────────────────────────
        design-testing — the eight screens, and the reasoning inside them
```

```
[ 0.000 ]  branch ............................ design-testing
[ 0.001 ]  screens ........................... 8
[ 0.002 ]  build step ........................ NONE
[ 0.003 ]  dependencies ...................... NONE
[ 0.004 ]  network at runtime ................ NONE
[ 0.005 ]  how to run ........................ open the file
[ 0.006 ]  status ............................ READY
```

---

## What this is

A solar-portal front end, drawn to be **judged as a finished product** rather than
as a wireframe. Eight standalone HTML files. Each one carries its own CSS, its own
script and its own demo data. There is no bundler, no package manager, no test
runner and no server.

**Double-click `login.html`.** That is the whole setup. It runs off `file://`, it
has never needed a network, and it will still run in five years on a laptop with
no toolchain on it.

> The comments in these files are **half the deliverable.** They record *what was
> there before and why it went* — at length, in prose. That is the most
> distinctive thing about this codebase and the reason it can be picked up cold.
> A change that removes something should say what it removed and why.

---

## The eight screens

| # | File | Lines | Size | What it is |
|---|------|------:|-----:|------------|
| 1 | `login.html` | 1,603 | 150 KB | The front door. A void with 8,920 real stars and the Earth's limb across the foot. |
| 2 | `plants.html` | 3,488 | **2.24 MB** | Site Control. The globe — the whole planet, falling to the fleet, landing on terrain. |
| 3 | `home.html` | 2,352 | 130 KB | Portfolio dashboard: KPI tiles, power-vs-irradiance, energy, plant KPI. |
| 4 | `monitoring.html` | 2,087 | 111 KB | Device rail, live power curve, gauge, history table. |
| 5 | `alarms.html` | 1,496 | 78 KB | The alarm log, newest first under a heading per day, with device / severity / status filters and a window. |
| 6 | `analysis.html` | 2,367 | 118 KB | Multi-device parameter comparison. **One frame, four series.** |
| 7 | `kpi.html` | 1,710 | 89 KB | One site, one metric, examined closely: actual vs simulated vs forecast. |
| 8 | `settings.html` | 3,268 | 162 KB | Ten panes: profile, assets, system config, access management. |

`plants.html` is 2.24 MB because the planet is **photographs, not gradients** —
NASA Blue Marble for the day side, Black Marble (VIIRS day/night band) for the
city lights, and a NASA Deep Star Map behind it, all inlined as base64.

> ⚠️ **Reading `plants.html`:** filter first or you will dump base64 into your
> terminal.
> ```bash
> awk 'length($0)<400' plants.html | less
> ```
> 3,483 of its 3,488 lines are readable. Five are texture plates.

---

## The arrival

The three screens before the portal are **one continuous journey**, not three
pages that happen to link to each other.

```
   login.html                plants.html               home.html
   ──────────                ───────────               ─────────
   the void                  the globe                 the portal
   stars · limb      ──▶     whole planet      ──▶     tiles · charts
   sign in                   fall to the fleet         light by default
                             land on terrain
        │                          │                        │
        └── the horizon RISES      └── one click on a        └── the room the
            while you wait —           site name opens           globe handed
            the wait IS the            that site                 you into
            approach
```

**The sign-in is a void, the globe is a void, and the portal opens light.** For
one revision it opened **dark**, so the arrival was one night-sky room the whole
way through; light was asked for as the state people land in, so it is the
default again. Dark is still there — it is what the switch in the header is for —
and it still carries the sign-in's sky behind its glass, so somebody who wants
the arrival unbroken is one click from it.

---

## Design system

### Tokens, per page

Every file opens with its own `:root{…}` of **43–64 custom properties**. They
overlap but are not identical, because each page needs what it needs.

| Page | Tokens | | Page | Tokens |
|------|-------:|---|------|-------:|
| `home.html` | 64 | | `alarms.html` | 63 |
| `kpi.html` | 64 | | `monitoring.html` | 54 |
| `settings.html` | 63 | | `analysis.html` | 53 |
| `plants.html` | 48 | | `login.html` | 43 |

**Colours are never literals in a rule.** A repaint is a token change.

### Two kinds of colour, and they are not the same thing

This is the rule most easily got wrong, so it is stated plainly:

|  | **Semantic** | **Identity** |
|---|---|---|
| Examples | `--green` healthy · `--red` alarm · `--amber` deviation | `--s1 … --s8` chart series |
| Answers | *which state is this?* | *which thing is this?* |
| Per theme | **Re-picked.** `#12a150` reads as green on white and vanishes into navy. | **Constant.** Same value in light and dark. |
| Why | Legibility on each ground | A line that changes hue when you flip the theme is a line you must re-identify. A screenshot in a report must match the live page. |

The series ramp is **eight mid-tones chosen to clear both grounds** rather than to
sit best on either — neither theme gets its optimum, and that is the price of the
colour meaning one thing:

```
--s1 #2e86e0 blue    --s5 #8b7ff0 violet
--s2 #c9860c ochre   --s6 #22b0c2 cyan
--s3 #12a08a teal    --s7 #93a03a olive
--s4 #c569a0 mauve   --s8 #e0739a rose
```

**Red is not in the set,** and the ochre is pulled well off the alarm amber in
both hue and lightness. A device that happened to land in that slot would be
wearing a fault colour while producing normally.

### Light / dark

```
storage key ....... localStorage['enerops-theme']
values ............ 'light' (default) | 'dark'
markup ............ <html lang="en">   — no data-theme is light
applied ........... head script, before first paint
carries ........... home · monitoring · alarms · analysis · kpi · settings
no toggle ......... login · plants — they are the void by design
```

**The default lives on the tag, not in the script.** The `<html>` tag carries no
`data-theme`, which is light, and the head script only ever *puts dark on* for
somebody who chose it. Storage can fail outright — blocked, cleared, a private
window — and the page still opens in the default, because the `try/catch` only
guards somebody's *choice*, never the default itself.

In dark, the portal also carries the **sign-in's own sky** at about a third
amplitude — three radial washes on `html`, so the glass panels have something to
lift off. Without it, 74%-opaque near-black on near-black composites to a flat
unlit slab.

### One dropdown idiom, not the browser's

Every list on every screen is drawn by the app. No page hands its list to the
operating system.

```
.msel        the mount
.mbtn        the button carrying the current value
  .mlab      its label     .any = nothing chosen     .off = a state, not a choice
.colpanel    the panel     .mpanel = width modifier
  .colhead   the heading over the list
  .colrow    a row — radio for one-of-many, checkbox for tick-several
  .colfoot   All / None — only when several may be true
```

Single choice **closes on pick and has no footer.** Multiple **stays open** with
All/None. Three helpers implement it, and which one a page has depends on what
that page needed first:

| Helper | Pages | Registry |
|--------|-------|----------|
| `singleSelect(o)` | monitoring · analysis · kpi · alarms | `PICKS` / `MSELS` |
| `multiSelect(o)` | alarms | `MSELS` |
| `data-ss` + `SSK` | settings | one panel, lent to whichever button is open |

`singleSelect` is backed by a **hidden input that keeps the id the old `<select>`
had**, so everything downstream still reads `.value` and still hears `change`.

### Typography

```
--mono   ui-monospace, 'SF Mono', 'Cascadia Code', 'Roboto Mono', Consolas
--sans   -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, Roboto
--serif  Georgia, 'Times New Roman'      (the wordmark, and site names)
```

No web fonts. These mockups open straight off disk and have never needed a
network.

---

## House rules

**Empty is a state.** An absent value prints an em-dash — never a zero, never a
plausible placeholder. A pending step shows nothing at all, because it has no
result yet.

**A gap is a gap.** A chart line *breaks* where a bucket has no value rather than
being drawn straight across it. A device that stopped reporting does not get a
line across the hours it was silent.

**Identity is never colour alone.** Every legend chip carries its name, and the
mark it draws is the mark the plot draws — a square, a dot, a triangle, a rule.

**One idiom per job.** Before adding a control, grep for the class names above and
reuse them. Do not introduce a second way to do something that already has one.

**Comments record the decision, not the code.** Before deleting something, write
the comment explaining what went and why.

---

## The demo fleet

Everything below is a constant in the files. Nothing is fetched.

### Sites — three, and each one is a real place

| Site | Address | Lat / Lng | AC / DC kW | Devices | Down | Warn | Crit |
|------|---------|-----------|-----------:|--------:|-----:|-----:|-----:|
| **Sangria** | 2 DLP, Kikarwali Road, Nathwana | 29.80 / 74.47 | 2500 / 2500 | 9 | 5 | 1 | 0 |
| **Rioja** | Plot 14, Bikaner Road, Bikaner | 28.02 / 73.31 | 1800 / 1885 | 8 | 0 | 0 | 0 |
| **Mendoza** | NH-52, Pokhran Road, Jaisalmer | 26.91 / 70.92 | 3200 / 3360 | 11 | 1 | 1 | 1 |

The globe places them by real latitude and longitude, against real sidereal time,
with a terminator computed from the actual solar position.

### Devices

```
INV01 … INV07    inverters
MFM01            multi-function meter
WMS01            weather station
```

A weather station has no power factor and an inverter has no irradiance. Asking
for one returns `null`, which prints as a dash. **Nothing measured and zero
measured are different facts.**

### Users and roles — `settings.html`

| User | Email | Role | Reach | State |
|------|-------|------|-------|-------|
| Vikram Sethi | vikram.sethi@enerops.example | `r-all` | All sites | Active |
| Priya Nair | priya.nair@enerops.example | `r-sangria` | Sangria only | Active |
| Arun Menon | arun.menon@enerops.example | `r-north` | Rioja & Mendoza | Suspended |

Suspended, **never deleted** — an alarm acknowledged by somebody who no longer
exists still has to say who acknowledged it.

> **Roles are given on Access Control and nowhere else.** The Add/Edit user dialog
> used to carry a Role field, which made it the second place a role could be set.
> Two places to set one thing is two places to look when it is wrong. Editing a
> user now leaves their role exactly as it was; a new one arrives with none.

### KPI metrics — `kpi.html`

| Key | Name | Unit | Dec |
|-----|------|------|----:|
| `PR` | Performance Ratio | % | 1 |
| `CUF` | Capacity Factor | % | 1 |
| `AVAIL` | Availability | % | 1 |
| `YIELD` | Specific Yield | kWh/kWp | 2 |
| `ENERGY` | Energy | kWh | 0 |
| `IRR` | Irradiation | kWh/m² | 2 |

### Parameter categories — `analysis.html`

```
AC Power        P_AC kW · S_AC kVA · Q_AC kVAR · COS_PHI
AC Electrical   V_AC V · I_AC A · F_AC Hz
DC Input        P_DC kW · V_DC V · I_DC A
Energy          E_TODAY kWh · E_TOTAL kWh
Temperature     T_INT °C · T_MOD °C · T_AMB °C
Irradiance      GHI W/m² · POA W/m²
Performance     PR % · CUF % · SPEC_YIELD kWh/kWp
```

### Storage keys

```
enerops-theme            'light' | 'dark'         the theme choice
enerops-plant            site id                  which site the portal is on
enerops-operator         email                    who signed in
enerops-analysis-views   JSON                     saved Analysis queries
```

**One site, chosen once.** Four pages used to carry their own site picker — four
answers to a question that has one. The site is chosen on Site Control and every
page reads it from this key.

---

## Screen by screen

### `login.html` — the front door

A void: 8,920 stars from the HYG catalogue placed by right ascension and
declination, an aurora wash, and the **limb of the Earth** across the foot —
a dark body with a bright edge, its atmosphere drawn as seven widening strokes
because a single stroke of even alpha is a band, not an atmosphere.

**The boot log** types four lines bringing the pages up:

```
[ 0.214 ]  monitoring ...................... READY
[ 0.395 ]  alarms .......................... READY
[ 0.611 ]  analysis ........................ READY
[ 0.742 ]  kpi ............................. READY
```

Not one line reports a plant. No site has been asked about yet, and a front door
that opened with a megawatt figure would be inventing the very thing the portal
exists to measure.

**The opening sequence.** Authenticate and the log is replaced by a live ledger —
four steps, all present from the first frame, in the boot log's own grammar:

```
OPS@ENEROPS.IN

[ 0.38 ]  connecting ...................... LINKED
[ 0.77 ]  loading sites ................... 3 SITES
[ 1.15 ]  preparing portal ................ READY
          opening ......................... ▌
▓▓▓▓│▓▓▓▓▓▓▓▓│▓▓▓▓▓▓░░░│░░░░░░░░   71 %
```

| Feature | Detail |
|---|---|
| **Times are measured** | Real elapsed seconds off the run clock, not written down. Which is why they are not round. |
| **Live clock** | The running row's time ticks in gold and *freezes* as its final figure. Written in hundredths — at 60 fps the last digit of a millisecond clock is a strobe. |
| **Notched bar** | Boundaries cut at **16 / 48 / 79** — where the steps actually end. The stages are not equal, and the bar says so before the run starts. |
| **`3 SITES`** | The fleet this build actually carries. If the fleet changes, that string is wrong and must change with it. |
| **SLOW** | Past 1.5× its expected time a row goes amber and says so, clock still climbing. A bar that has stopped and a bar about to move look identical; this answers it. |
| **Failure** | Row red with a *specific* reason — `NO ROUTE`, `NO RESPONSE`, `REFUSED`, `TIMED OUT`. Bar freezes red at the percentage reached. Untried rows stay blank. **RETRY** appears. |
| **The descent** | The horizon **rises** and its curve deepens as the run goes — the wait *is* the approach to the planet the next screen opens on. |

The descent is driven by the **clock, not the bar**: the bar rests at each of its
four boundaries, and a camera that stalls four times in two seconds is a shot with
four hiccups. It also **never goes backwards** — a failure freezes it, and RETRY
carries on from that height. You do not un-travel because a request timed out.

### `plants.html` — Site Control

The screen opens on the whole planet, falls to wherever the fleet actually is, and
lands on satellite terrain with the sites labelled on the ground.

- **The field is night, and it is real.** NASA Blue Marble, Black Marble, Deep Star Map.
- **Night imagery resampled in linear light,** not gamma space. Downsampling city lights the naive way averages in the wrong domain and throws away most of their flux. This is the single reason the night side reads the way it does.
- **The terminator is computed** from the real solar position, not drawn.
- **One list, not two columns.** A scrolling rail of names; one card opens beside whichever name you click. Two fixed columns could not count past a dozen a side.
- Top and bottom strips are **masked gradients**, denser where the type sits — a solid bar cut the picture into three.

### `monitoring.html`

Device rail on the left, live power curve, gauge, history table. Two devices are
plotted — **INV06 and INV07, wearing `--s1` and `--s2`.** They used to wear
`--green` and `--blue`, which meant the plotted line and the health dot beside it
were the same colour: *"this is the series"* and *"this device is healthy"* said in
one hue.

The **Online / Offline tally** at the foot of the rail is gone. It restated what
the cards above it already said, more plainly, and counting them is both quicker
than reading a summary and the only way to find out *which* five are down.

### `analysis.html` — one frame, four series

```
        ┌ Analysis Data ─── [INV06 Power] [INV07 Power] [WMS01 POA] ┐
        │                                                            │
        │  kW ─┐                        ╭──────╮              ┌─ W/m²│
        │  400 ┤            ╭─── INV06 ─╯      ╰──╮           │  1000│
        │      │      ╭─────╯                     ╰─────╮     │      │
        │  200 ┤  ╭───╯ ┄┄┄┄┄┄┄┄ WMS01 POA ┄┄┄┄┄┄┄┄╮    ╰──╮  │   500│
        │      │ ╭╯ ┄┄┄┄┘                          └┄┄┄╮  ╰╮ │      │
        │    0 ┼─┴───────────────────────────────────────┴──┴─┤    0 │
        │       06:00      09:00      12:00      15:00     18:00     │
        └────────────────────────────────────────────────────────────┘
          solid reads the LEFT scale · dashed reads the RIGHT
```

Every plotted device is drawn into **one frame**, sharing one baseline and one
set of gridlines. That is what makes the comparison exact: the gap between two
curves is read off directly rather than estimated across a gutter.

- **Two scales, told apart by stroke.** Solid reads Y1 down the left, dashed reads Y2 down the right. The axis a line belongs to is the one thing a two-scale plot cannot show by itself, so the axis titles and the legend chips carry the same mark rather than leaving it to be worked out.
- **`PLOTCAP = 4`, and it is a *colour* cap.** In one frame the only thing keeping two curves apart is their hue, and past four there is no fifth that stays clear of the other four for a colour-blind reader. A fifth device is still selected — it stays in the table, and the legend's last chip says `+N more in table` rather than the chart quietly dropping it.
- **The right gutter only exists when Y2 does.** With one axis it would be 58 px of nothing between the last reading and the card edge, so `MR` is 58 or 20 depending on whether there is a second scale to print.
- **The plot keeps its proportions** — height tracks the card's width inside a 230–380 px band. A chart is read as a shape, and a shape that changes with the window is a different chart at every width.
- **A gap is a gap.** A device that stopped reporting gets a *broken* path, not a straight line bridging the silence — and the fill under it breaks with it, one closed shape per run of readings.
- **Empty is a state.** Nothing selected still draws the frame, with the note sitting on a plot rather than on a blank rectangle.

> **Split panels were tried here, and went.** For a while the chart could be
> stacked one panel per device — named surfaces, shared scales, one time axis
> under the whole stack — and briefly it was offered both ways on a segmented
> control in the chart's head. The switch went with the split. The chart is one
> frame; a control with one setting is not a control, it is a label that looks
> clickable. What the split left behind is worth keeping in mind if it ever
> comes back: the band is still a **returned value** rather than four loose
> constants, so the gridlines, the scales, the series and the crosshair all read
> one geometry from `plot()` instead of each recomputing it. The `PLOTCAP` of 8
> went too — a line alone in a named panel is not told apart by its colour, so
> the limit there was vertical room, and that reason left with the panels.

### `kpi.html` — three readings, three marks

| Series | Mark | Why |
|--------|------|-----|
| **Actual** | bar | Measured. A bar sits on the baseline and its height is the whole of it. |
| **Simulated** | line + **hollow dot** per bucket | A model is continuous. The dots let it be read value by value; hollow so the bar shows through. |
| **Forecast** | **filled triangle**, no line | A set of separate estimates, not a curve through anything that happened. |

It was a solid rule and a dashed rule. Over a bar chart a stroke is the worst place
for a distinction: it crosses the bars at a shallow angle, the dashes land in the
gaps as often as on the bars, and at 31 daily buckets the two rules are thin lines
a few pixels apart. Telling them apart meant reading the colour — the one thing a
mark is supposed to spare you.

The chips and tooltip rows draw the **same geometry as inline SVG**, so a mark is
defined in one place.

### `settings.html` — ten panes

```
Profile Management     user-profile · company-profile
Asset Management       customer-devices
System Configuration   emission-rate · electricity-rate · energy-offset · alarms-config
Access Management      access-role · access-user · access-ctl
```

The device table **does not sort.** Every column was click-to-sort with a triangle
on the active one. The triangle was the visible half; taking only it away would
leave a table that reorders itself when a header is clicked and never says so —
worse than either keeping the feature or dropping it. Order is by name, always.

---

## Controls, everywhere

| Control | Options | Notes |
|---------|---------|-------|
| **Refresh** | Off · 5 min · 10 min · 15 min | Header, all six portal pages. Only `monitoring` runs a real timer. `analysis` and `kpi` default to **Off** — a closed historical window does not move while you read it. |
| **Rows per page** | 25 · 50 · 75 · 100 · 150 · 200 | Table footers. Opens **upward** — a list dropped downward from a page footer opens into the window edge. |
| **Theme** | ☾ / ☀ | Header. Names *what it will do*, not where you are. |
| **Escape** | closes any open panel | 19 handlers across the eight files. |

---

## Review affordances

These are **not features.** They exist so states that cannot be reached by using
the screen normally can be seen, screenshotted and signed off.

```
login.html?fail    stops the run at 'loading sites' — first attempt only.
                   RETRY then completes, so one screen carries the whole story:
                   it broke → it said which part and why → it offered the way
                   out → the way out worked.

login.html?slow    makes that same step overrun until the real SLOW detector
                   trips. The detector is real; the flag only gives it
                   something slow to detect.

any key            skips the boot log. Somebody who has seen it once should
                   not have to sit through it again.
```

---

## Verifying a change

There is no test runner. There is a browser.

```bash
# render a page headless
"/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" \
  --headless=new --disable-gpu --window-size=1400,900 \
  --screenshot=out.png --virtual-time-budget=4000 \
  "file:///$(pwd -W | sed 's| |%20|g')/home.html"
```

**Three things worth knowing before you trust a headless run:**

1. **Use a `file:///` URL.** A bare filename resolves as `http://home.html/`.
2. **A `requestAnimationFrame` loop stalls the virtual clock.** Shim it onto
   `setTimeout` in a temp copy to drive an animation through to the end.
3. **Verify the states the change created, not the one the page loads in.** Two
   real defects in this tree survived a screenshot pass because both lived in
   states a static capture never reaches — one needed a hover, one needed a
   second animation frame.

Drive interactive states with an injected script in a temp copy — synthetic
`mousemove` for hover, `.click()` for flows — and delete the copy afterwards.

---

## Traps this codebase has already fallen into

Recorded so they are not re-discovered.

| Trap | What happened |
|---|---|
| **Descendant type selectors** | `.chartwrap svg{width:100%}` was harmless while the only `<svg>` inside was the plot. The tooltip lives in `.chartwrap` too — the day its swatches became inline SVG, hovering a bar produced a tooltip the size of the card. A descendant selector is a claim on the *future* contents of a container. Both chart pages now use `.chartwrap>svg`. |
| **Duplicate ids** | A rows-per-page control mounted on `id="per-pick"` — which KPI already used for its **period** picker. `getElementById` returns the first match, so the control mounted inside the wrong element and never appeared. No error, no warning. Any id is a claim on a namespace you did not write. |
| **Mixed clocks** | Seeding a `requestAnimationFrame` loop with a `performance.now()` reading. They are not guaranteed to be the same clock; the second frame arrived *before* the start, the ease squared it, and the panel counted down to **−586 %**. The first frame that runs is time zero. |
| **Circular thresholds** | A "this is slow" detector compared elapsed time against the same budget the demo flag was stretching — so a step told to run four times longer also got four times longer before counting as late. A deadline derived from the thing it is meant to catch can never be missed. |
| **Once-per-resize painters** | A canvas painter that sized the buffer *and* drew was correct at one call per resize and pathological per frame — `canvas.width` reallocates the backing store. Split into `size()` and `draw()` before animating anything. |
| **Stale comments** | `login.html` opened with *"THE FRONT DOOR IS LIGHT NOW"* while the `:root` sixty lines below overrode every token to the void's values. A comment that says the opposite of the code is worse than no comment. |

---

## Repository

```
remote ....... github.com/GB-Infrared/Portal-UI
branch ....... design-testing
nested ....... design-testing/ is its own git repository,
               separate from the tree that contains it
```

`portal-react/` **no longer exists** and should not be recreated. The mockups in
this folder are the source of truth for all design and interaction work.

---

```
[ ok ]  eight screens · no build · no dependencies · no network
[ ok ]  open login.html
```
