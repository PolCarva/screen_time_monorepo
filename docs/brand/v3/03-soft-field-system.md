# Still v3 — Soft Field system

Status: **selected and frozen for implementation**
Direction board: `brand/v3/explorations/02-soft-field.png`

## 1. Strategic sentence

**Still makes the automatic moment visible, then gives the choice back.**

The product is not a blocker, a digital detox, a moral score or a wellness ritual. It is a quiet instrument for noticing and choosing. The brand should feel warm because it respects the person, and precise because it reports real behavior.

## 2. Core behavior → visual behavior

| Product state | Field state | Meaning |
| --- | --- | --- |
| Automatic opening | compact, dense modules | the choice is not yet visible |
| One-second pause | modules separate once | space appears for a decision |
| Go back | modules settle with more room | one automatic opening was avoided |
| Timed pass | one peach module remains offset | the person chose to continue intentionally |
| Daily progress | modules accumulate by day | minutes returned, not a score |
| Verified impact | one module gains measured depth | only confirmed value gets physical volume |

The field is never wallpaper. If a module does not encode a value or a transition, remove it.

## 3. Identity

### Wordmark

- Name: **Still**.
- Set in Recursive Sans Linear, weight 650.
- No altered letterforms and no “i” gimmick.
- Sentence case in product; title case in lockups.
- Tracking: `-0.045em` above 24 px, `-0.025em` below 24 px.

### Mark

Selected construction: **Field Aperture / 06**, chosen after comparing twelve constructions at mark, launcher and 32 px sizes. Six measured modules form three rows; the middle pair moves outward and changes state. The negative space is the pause and the peach module is an intentional continuation. It is deliberately abstract: no clock, pause bars, leaf, phone, brain or initial.

- Base grid: 12 × 12 units.
- Module: 4.4 × 1.85 units.
- Optical corner: 0.38 units; never pill-shaped.
- Outer rows use a 1.2-unit central gap; the middle row opens by a further 1.1 units on each side.
- Default: four graphite modules, one mineral module and one muted-peach module.
- One-color fallback: all graphite or all chalk.
- At 32 px: remove optical radius and align to whole pixels.
- The mark must never animate continuously. In launch motion, the middle pair moves once from aligned to open in 520 ms.

### App icon

- Chalk ground, mark optically centered from its actual bounds (58% maximum width).
- iOS icon: system corner mask only; no internal rounded tile.
- Android adaptive icon: 66% safe-zone construction; chalk background layer and field foreground layer.
- Dark variant: graphite ground, three chalk modules and one peach module.
- No gradient, shine, shadow, grain or pseudo-3D.

## 4. Typography

Primary and only family: **Recursive**, licensed under SIL OFL 1.1.

Why it belongs: the family moves between proportional and mono and between linear and a controlled casual drawing without changing its footprint. This gives Still one coherent voice for interface, data and human microcopy.

| Role | Axes / weight | Use |
| --- | --- | --- |
| Display | `MONO 0`, `CASL 0.08`, 520–600 | short product statements only |
| UI | `MONO 0`, `CASL 0`, 450–700 | navigation, buttons, forms, body |
| Data | `MONO 1`, `CASL 0`, 500–650 | time, money, counts, IDs |
| Human note | `MONO 0`, `CASL 0.16`, 480 | rare reassurance or empty state |

Mobile can use static instances that match these axis positions; web uses the variable file. Never morph axes while text is being read. A transition may change `CASL` only in a single short word after the layout has settled.

### Type scale

| Token | Mobile | Web | Line height |
| --- | ---: | ---: | ---: |
| `display-hero` | 58 | clamp(72, 10vw, 152) | .92 |
| `display` | 44 | clamp(48, 6vw, 92) | .98 |
| `heading-1` | 32 | 52 | 1.04 |
| `heading-2` | 24 | 36 | 1.12 |
| `body-large` | 18 | 21 | 1.45 |
| `body` | 16 | 17 | 1.5 |
| `body-small` | 13 | 14 | 1.45 |
| `label` | 11 | 11 | 1.35 |
| `data-hero` | 72 | 112 | .92 |

## 5. Color

### Brand palette

| Token | Value | Function |
| --- | --- | --- |
| `chalk` | `#F1EFE8` | primary ground |
| `chalk-raised` | `#F8F6EF` | native/modal ground, not a card default |
| `graphite` | `#242826` | primary ink and dark ground |
| `graphite-soft` | `#4E5451` | secondary ink |
| `mineral` | `#697F8C` | recognizable brand color and measured progress |
| `mineral-light` | `#A7B5BA` | inactive/data support |
| `peach` | `#D39A83` | conscious exception, selected continuation |
| `fog` | `#D9DEDC` | inactive modules and dividers |
| `white` | `#FFFDF8` | text on graphite when chalk is insufficient |

### Functional palette

Functional states stay separate from the brand accents.

| Token | Value | Use |
| --- | --- | --- |
| `success` | `#2F6B4A` | confirmed, complete |
| `warning` | `#9A6A27` | pending or expiring |
| `danger` | `#A9473E` | destructive/error |
| `focus` | `#315CBE` | focus ring only |

No beige-and-green palette. Mineral is blue-grey, not sage. Environmental impact uses data and evidence, not a green wash.

## 6. Material and texture

Digital tactility comes from spacing, precise edges, low-contrast surfaces and localized microtexture.

- No global grain overlay.
- A 1–2% monochrome noise may appear inside a measured field module, large campaign numeral or verified-impact extrusion.
- No paper tears, fibers, clay, pebbles, glassmorphism or inflated blobs.
- Default surfaces are flat. Elevation appears only when a layer actually floats above another layer.
- Maximum surface radius: 8 px. Primary field modules use 2–5 px. App icon modules become square at 32 px.

## 7. Layout

- Base spacing: 4 px; working rhythm: 8 / 12 / 16 / 24 / 32 / 48 / 72 / 96.
- Product uses open vertical groups separated by hairlines, not card stacks.
- One protagonist metric per screen.
- Secondary metrics align on a shared baseline or rule.
- Edge padding: 24 px mobile, 32 px tablet, max 80 px web.
- Website container: 1320 px; long-form copy: 34–46 characters.
- Rounded rectangles are reserved for controls, native modal containers and the app icon mask.

## 8. Progress field

The progress field is the ownable data visualization.

### Daily field

- Seven columns, one per day.
- Five modules per day at the default density.
- One module represents a configurable interval of returned time; its accessible label states the actual minute total rather than requiring visual decoding.
- Module opacity encodes completion within the interval.
- A peach module records a consciously used pass; it never means failure.
- Today is identified with typography, not a differently shaped card.

### Intervention field

- Six rows by seven modules.
- Starts dense.
- Over 520 ms, left modules translate left and right modules translate right; easing `cubic-bezier(.16, 1, .3, 1)`.
- The center gap reveals the question. No looping and no bounce.
- One light haptic at the end of the opening movement.
- Reduced motion: render the final separated state immediately and keep the 1-second numeric timer.

### Impact physicalization

Optional 3D uses an orthographic field. Module height equals confirmed allocated value against the disclosed scale. Pending values stay flat. No spheres, stones, seeds, leaves or decorative depth.

## 9. Screen hierarchy

### Today

The first viewport answers, in order:

1. **42 minutes returned today** — protagonist.
2. **6 apps protected** — current selection count.
3. **Field progress** — seven days with today at the end.
4. **$1.84 verified impact** — value plus state and provenance link.
5. **Review 2 new apps** — next meaningful action.

No quote, score, streak, generic greeting or motivational card.

### Interruption

1. App name and `00:01`.
2. Field opens.
3. Observed fact: “Instagram opened 7 times today.”
4. Question: “What do you want from the next 10 minutes?”
5. Primary: “Go back.”
6. Secondary: “Use 1 pass · 10 min.”
7. Quiet tertiary escape only where platform policy requires it.

The language never says “you failed”, “you are addicted” or “be productive”.

### Impact

Data first: available amount, state, source, allocation criteria, selected project, vote, publication date and proof. The most visible visual is the allocation field; emotive project imagery is secondary.

## 10. Photography

Photography shows the result of attention, not a person fighting a phone.

- Natural window light and ordinary color temperature.
- Hands making, repairing, writing, cooking or waiting.
- Quiet transitions: a table after use, an open window, shoes by a threshold, a bus seat, a half-finished task.
- Phone absent or peripheral and face never staged in “digital detox relief”.
- Crops can be close but must retain environmental evidence.
- No mountains-at-sunrise, lotus pose, family-running-on-beach, plant-on-desk or fake documentary NGO imagery.

## 11. Copy voice

- Concrete: describe what happened, when and for how long.
- Calm: short statements without urgency theater.
- Intelligent: disclose estimation, pending states and provenance.
- Non-moral: a pass is an intentional choice, not a failure.
- Avoid “take back your life”, “unlock your potential”, “reclaim your time”, “mindful journey”, “better you” and “save the planet”.

Examples:

- “42 minutes returned today.”
- “Instagram opened 7 times today.”
- “This amount is estimated until the weekly close.”
- “No apps selected yet. Choose the ones you tend to open automatically.”

## 12. Anti-AI-slop gate

Reject a screen or asset if any answer is “yes”:

- Is a natural symbol carrying the concept?
- Is the visual language mostly beige, sage and a serif?
- Is an organic blob, sphere or 3D object merely decorative?
- Are there more containers than information groups?
- Could the same copy belong to any wellness or productivity app?
- Does motion loop, bounce or perform without changing state?
- Does impact rely on sentiment before evidence?
- Is texture global or strong enough to reduce legibility?
- Is the field present without data?
- Is a pass framed as defeat?

## 13. Accessibility and platform behavior

- Text contrast target: WCAG AA; large display is not exempt from manual checks.
- Minimum tap area: 44 × 44 pt iOS, 48 × 48 dp Android.
- Do not encode pending/verified or pass/go-back by color alone.
- Every field receives one readable summary plus optional per-day descriptions.
- Dynamic Type must preserve CTA order and never overlap the field.
- Native Shield/Android intervention may simplify material and animation, but must preserve app context, observed fact, timer, primary exit and secondary timed pass.
- Dark mode uses graphite ground, chalk text, mineral-light field and the same peach choice accent. It does not invert semantic colors blindly.
