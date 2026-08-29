# Still v3 — final QA and Definition of Done

Status: **passed — 29 August 2026**

## Scope and evidence

| Deliverable | Evidence |
| --- | --- |
| Market, product and anti-slop audit | `01-audit-and-research.md` |
| Three explored art directions and decision | `02-exploration-and-selection.md`, `brand/v3/explorations/` |
| Frozen identity, tokens, voice, accessibility and motion rules | `03-soft-field-system.md` |
| Reusable mark, logo, launcher, adaptive and splash assets | `brand/v3/identity/` |
| Complete mobile redesign | `apps/mobile/app/`, native iOS and Android intervention surfaces |
| Narrative responsive landing | `apps/web/app/`, `apps/web/components/` |
| Directed photography | `brand/v3/photography/` and `apps/web/public/images/v3/` |
| App Store, social, educational and paid campaign exports | `brand/v3/campaign/` |
| Brandbook | `output/pdf/Still-Soft-Field-Brandbook.pdf` (39 pages) |

## Visual consistency audit

- The selected `Soft Field` direction is present in product, web, native surfaces, icon, campaign and brandbook; no remaining UI uses the prior display font or pale-sage/serif direction.
- The Field Aperture mark carries state and data: it is not background decoration.
- No leaves, plants, stones, ambient 3D objects, generic wellness images, global grain, glass surfaces, purple gradients, pill-heavy card stacks or motivational-startup copy remain in the new work.
- The only dimensional treatment is the orthographic impact field, whose height is reserved for disclosed verified value.
- The app icon and Android foreground were regenerated from `generate_v3_icon_study.mjs`; their non-background bounds both resolve to exact centre `[512, 512]` in a 1024 × 1024 canvas.

## Product and accessibility audit

- Today states the protagonist metric, selected app count, seven-day progress, impact state and next action in its first viewport.
- Intervention preserves the one-second pause, observed behavior, a clear exit, intentional timed pass and non-punitive language.
- Shield, Device Activity report and Android InterventionActivity use the same tokens and content hierarchy as the React Native product.
- Reduced-motion behavior, one haptic at field completion, readable field summaries, distinct functional states and 44/48 point touch-target rules are specified and implemented where platform APIs permit.
- Illustrative impact values are labelled illustrative; campaign guidance requires replacing them with live-ledger values before publication. The quote template intentionally remains a template until a real, authorised quote is supplied.

## Responsive and build verification

| Check | Result |
| --- | --- |
| Web Playwright QA at 1440 × 1000 and 390 × 844 | Passed; no overflow, loaded photos, CTA, impact route and no browser errors. Screens: `brand/v3/qa/` |
| `pnpm check` | Passed: lint, type checks and contracts/web/mobile test suites |
| `pnpm --filter web build` | Passed; all 23 routes generated |
| `./gradlew :app:assembleDebug` | Passed; debug APK generated |
| iOS Screen Time targets | Passed independently: Shield Action, Shield Configuration, Device Activity Monitor and Device Activity Report |
| iOS full workspace build for iPhone 16e simulator | Passed with `xcodebuild` |
| Brandbook PDF | Rendered all 39 pages and visually inspected through contact sheets |

## Known non-blocking warnings

- The Android and iOS builds report deprecations and nullability warnings in Expo, React Native, Sentry and Google Mobile Ads dependencies.
- The project configuration warns that production Google Mobile Ads IDs must be supplied by environment/configuration. This predates the identity work and is intentionally not replaced with a fabricated ID.

## Handoff

- Re-run identity exports after any mark change: `node scripts/generate_v3_icon_study.mjs`.
- Re-run campaign exports: `node scripts/generate_v3_campaign.mjs`.
- Re-run the brandbook after identity or copy changes: `python3 scripts/generate_v3_brandbook.py`.
- Re-run web QA: `node scripts/qa_v3_web.mjs`.
