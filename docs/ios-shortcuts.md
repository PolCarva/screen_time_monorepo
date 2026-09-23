# iOS Shortcuts pause flow

Still uses a personal automation on iOS to learn which app the user opened and
to return to that same app after the decision. Apple does not expose another
app's bundle identifier to Still and gives apps no API to create, inspect or
verify personal automations, so the automation itself is always set up by the
user in Apple's Shortcuts app.

The research, the decisions behind this design and the open device hypotheses
live in `docs/ios-shortcuts-v2-plan.md`.

## Release status

The flow is built and covered by unit, contract and compiled-build tests, but
it has **not** been validated on a physical iPhone yet and is not part of the
Android v1 release. It stays off in production through the remote
`iosRestrictionEnabled` flag, which both the app and the App Intent honor.
Turning it on is an explicit operator action in `/admin`.

## What the user does

1. **Choose apps in Still** (`/ios-apps`). iOS gives no app the list of
   installed apps (one sec does not get it either: its list is its own catalog,
   and anything else is typed in with a URL scheme). Still gets as close as iOS
   allows in two ways. Catalog apps found on the device through their URL
   scheme are listed first under **On this iPhone**. Any other app is picked,
   without typing, from the real app list inside Shortcuts' trigger: the
   automation passes **Current App** to Still, and the intent adopts whatever
   name arrives, so the app shows up in Still the first time it is opened.
   Typing a name remains as a fallback. Still and Shortcuts themselves are
   reserved and never paused. The choice never leaves the device.
2. **Connect Shortcuts** (`/shortcut-setup`). Still picks the easiest tier the
   device supports:

   | Tier | iOS | Steps | Status |
   | --- | --- | --- | --- |
   | Import | 27+ | Add a shared shortcut, pick the apps in its trigger, flip its switch | Off until H2 is validated |
   | Single automation | 18.2+ | One automation for every app using **Get Current App** | **Active**; trigger semantics still to be confirmed on a device |
   | Per app | 16.4+ | One automation per app | **Active** below 18.2, and as the user's fallback |

   The per-app tier is shown one tap at a time, each step with **Shortcuts'
   own screen drawn in code**, in the phone's language, and the control to tap
   ringed (and numbered when there are several). The example is always
   Instagram:

   1. In the trigger list, search **App** and tap it.
   2. Tap **Choose**.
   3. Check **Instagram**, then the blue check mark.
   4. Tap **Run Immediately**, keep **Notify When Run** off, tap **Next**.
   5. Tap **Create New Shortcut**.
   6. Tap **Search Actions** and type **Still**.
   7. Tap **Pause Before Opening** (**Pausar antes de abrir** on a Spanish
      iPhone). An automation saved without this step shows
      up as "No actions" in Shortcuts and does nothing; it is the easiest step
      to miss, so the repair screen leads with it.
   8. Tap **App name** and pick **Instagram** from the list. Nothing to type.
   9. Tap the blue check mark to save.

   Every picture is a button. Shortcuts has no URL for the middle of its "new
   automation" sheet, so only the entry points land on the exact screen:

   | Tapping | Opens |
   | --- | --- |
   | Step 1 | `shortcuts://create-automation`, the trigger list itself |
   | First return-shortcut step | `shortcuts://create-shortcut`, a new shortcut |
   | Repair buttons | `shortcuts://automations`, the Automation tab |
   | Every other step | `shortcuts://`, which resumes the sheet where it was left |

   `create-automation` and `automations` are not documented by Apple; they were
   verified on iOS 26.0 and fall back to `shortcuts://` if they ever stop
   opening. The user comes back with iOS's own "◀ Still" breadcrumb.

   Apps outside the catalog have no URL scheme Still can open. By default,
   after the ad Still starts the access window and offers the Home Screen, and
   the user opens the app, now without a pause. Optionally, a shortcut named
   exactly `Still - [App name]` with a single **Open App** action lets Still
   reopen it directly.

3. **Test it.** Tapping **Test** arms a two-minute probe and opens the app.
   When the automation fires, Still comes back with a "connected" screen. A
   test never counts as an opening and never shows an ad. If nothing fires,
   the row says so and links to `/shortcut-repair`.

The tiers are controlled by `IOS_SHORTCUT_IMPORT_URL` and
`IOS_SINGLE_AUTOMATION_ENABLED` in `apps/mobile/src/lib/ios-shortcut-setup.ts`.
Set them only after the matching hypothesis is recorded as validated in
section 10 of the plan; no other code changes are needed.

## Runtime contract

1. Opening YouTube triggers `PauseBeforeOpeningIntent` in the background.
2. The intent resolves the name against the apps mirrored from Still. Aliases
   ("Twitter" / "X") share one allowance and one counter. An app Still has
   never seen is adopted; an app the user removed in Still keeps the intent
   silent. Every run records `lastTriggered`, which is the only evidence that
   an automation is alive.
3. If the remote kill switch is off, or YouTube has an active allowance, the
   intent finishes in the background and YouTube stays visible.
4. Otherwise it stores an app-scoped intervention and conditionally brings
   Still to the foreground.
5. Still shows the gate: **I don't want to go in anymore** (primary), **Watch
   ad** when an ad is ready, and, small and muted under it, **Use 1 emergency
   pass** when a pass is saved. The pass never waits for the ad, but it is never
   the first choice. On a cold start the ad waits up to 12 seconds for AdMob;
   with neither an ad nor a pass, a 15-second pause takes over. The free daily
   emergency access was removed (`docs/real-impact-stats-plan.md`, D1-D3).
6. Only after the ad is completed and the reward is confirmed does the window
   get chosen: a slider from **1 min** to **Rest of day**, with
   **I want to go in · <window>** / **I don't want to go in anymore** under it.
   Closing the ad early returns to the gate with no penalty and no reward.
   Nothing about the window is configured in advance; a saved pass reaches
   the same slider. The stops are
   `ACCESS_DURATION_STEPS` in `packages/contracts/src/domain.ts`, and
   **Rest of day** is resolved to the time left until local midnight at the
   moment access is granted.
7. **I want to go in** records the unlock, starts the app-scoped allowance for
   the chosen window and opens `youtube://`. If that scheme fails, Still runs
   `shortcuts://run-shortcut?name=Still - YouTube` instead and stops offering
   the scheme on that device. YouTube's automation fires again, sees the
   allowance and does not reopen Still until it expires. An unlock earned with
   the 15-second pause lasts five minutes, is not chosen on the slider, spends
   nothing and is not reported.
   The allowance is stored as a deadline, never as a countdown, so staying
   inside YouTube cannot extend it: from that instant the next opening is
   paused again. At the same second Still delivers a time-sensitive
   notification saying the window is over, which is the only thing iOS lets a
   third-party app do to a foreground it does not own (see
   [platform limitations](#platform-limitations)).
8. **I don't want to go in anymore** cancels the intervention and records an
   avoided open. A reward already earned is kept as a stored pass. Still then
   leaves to the Home Screen through a fallback chain: the native suspend call
   when the remote `iosHomeOnCancelEnabled` flag is on, else the helper shortcut
   `Still - Inicio` when the user installed it, else a hint to swipe up.

The same flow is specified as a pure state machine in
`apps/mobile/src/lib/intervention-flow.ts`.

## Build acceptance

Before building or installing, run the physical-device preflight:

```sh
pnpm --filter mobile acceptance:ios-device-ready
```

It requires an online, unlocked and trusted physical iPhone or iPad plus at
least one valid Apple code-signing identity. Its failure message distinguishes
an offline device from missing signing credentials. Installing on iOS 27 needs
an Xcode that ships the iOS 27 SDK, or a build distributed through EAS.

Then verify the compiled app contract. The command checks that Shortcuts can
discover the action, that its single app parameter offers the apps chosen in
Still as options, that Still only foregrounds dynamically, that the Spanish
of Still's action (`ios/Still/Localizable.xcstrings`) reached the bundle, and
that the production iOS AdMob application id did too:

```sh
pnpm --filter mobile acceptance:ios-shortcuts -- /absolute/path/to/Still.app
```

This build gate complements rather than replaces the device test below.

## Guide pictures

The guide has no screenshots. Each step's picture is Shortcuts' screen drawn
in code (`apps/mobile/src/components/guide/ios-shortcuts-screens.tsx`, with
`ios-kit.tsx`, `app-icons.tsx` and `replica.tsx`), measured on captures of an
iPhone 15 on iOS 26.0 and checked side by side with them. Labels are Apple's
own, in the phone's language: `src/lib/system-strings.ts` holds English,
Spanish (Spain) and Spanish (Latin America), and the step texts quote the same
entry the picture draws. Where Spanish wraps differently (the automation
subtitle, the selected **Nombre de la app**), the drawing follows the real
screen. Each ring is a `<Tap>` around the real element, so it moves with it.

After an iOS redesign, capture the flow in a simulator, compare it with the
drawn screen and adjust that screen's measurements; new labels go in
`system-strings.ts`. `guide-assets.test.ts` fails if a screenshot of the guide
comes back into the app.

## Testing in the iOS Simulator

The simulator can exercise everything **after** the trigger, but never the
trigger itself: Shortcuts registers the "App is opened" automation with
CoreDuet, and the simulator does not run the `contextstored` / `coreduetd`
daemons that publish which app is in focus, so the automation never fires
there. Stand in for it with a plain shortcut that runs the same action.

1. Production keeps the iOS pause off. In `apps/mobile/.env.local` set
   `EXPO_PUBLIC_DEV_IOS_PAUSES=1` (and `EXPO_PUBLIC_DEV_IOS_HOME_ON_CANCEL=1`
   to exercise the Home Screen exit). Both are ignored outside `__DEV__`.
   The server still rejects unlock reports while its own flag is off; they
   queue locally and do not affect the flow.
2. Build for the simulator **with** signing (`xcodebuild … -sdk iphonesimulator
   -destination 'platform=iOS Simulator,id=…'`, without
   `CODE_SIGNING_ALLOWED=NO`). An unsigned build has no Keychain entitlement
   and the session cannot be stored.
3. In Still choose **News** (catalog app present in the simulator, returns
   through `applenews://`) and add **Fitness** by name (returns through the
   `Still - Fitness` shortcut).
4. In Shortcuts create `Test Still News` and `Test Still Fitness`, each with
   the single action **Pause Before Opening** set to that app, plus the return
   shortcut `Still - Fitness` (**Open App → Fitness**).
5. Run `shortcuts://run-shortcut?name=Test%20Still%20News` (or tap the tile).
   Still comes to the foreground exactly as it would from the automation.

Observed on the iOS 26.0 simulator (2026-09-22), driving the flow with a
pending context written straight into the App Group so the automation did not
have to fire: the gate says the window is chosen in the next step; a stored
pass and a completed ad both lead to the slider (the Emergency Access checked
then has since been removed); the slider
runs 1 min → Rest of day and the primary action reads **I want to go in ·
&lt;window&gt;**; choosing 1 min stored an allowance ending exactly 60 seconds
later and registered `still.window-ended.<targetKey>`; Still opened News
through `applenews://`; and 60 seconds later SpringBoard presented that
notification **while News was in the foreground**, with the allowance expired
from that second on.

Observed this way on the iOS 26.0 simulator (2026-09-20): the action lists
exactly the apps chosen in Still and accepts variables; Still foregrounds with
no confirmation dialog; the ad, the confirmed claim and the two final options
appear in that order; **I want to go in** returns to News directly and to
Fitness through its return shortcut; the intent stays silent during the access
window; a setup test shows the connected screen without counting an opening;
**I don't want to go in anymore** lands on the Home Screen and the next launch
opens on Today; counters are per app. The first run of a return shortcut shows
an iOS prompt ("Allow … to output 1 app?"); **Always Allow** removes it.

## Physical release acceptance

None of these have been observed on a device yet; the simulator run above
covers points 2–4, 6–9 and 11 except for the automation trigger itself, which
only a physical iPhone can prove. Run the checklist on an iPhone after
installing the native build, with `iosRestrictionEnabled` on:

1. Open Still once. Settings shows **Choose your apps** and `0/0 APPS`, not a
   green "active" state.
2. Choose YouTube and one app outside the catalog in `/ios-apps`. In Shortcuts,
   **Pause Before Opening** lists exactly those two apps under **App name**.
3. Configure YouTube with the four per-app steps, tap **Test** in Still, and
   confirm Still returns by itself with **YouTube is connected** and that the
   day's counter did not increase.
4. Open YouTube. Still shows `YouTube opened 1 time today` with **Watch ad** and
   **I don't want to go in anymore**, and no final options yet.
5. Start the ad and close it early. Still returns to the gate, says nothing was
   unlocked, and offers the ad again.
6. Complete the ad. Only now **I want to go in** / **I don't want to go in
   anymore** appear. Choose **I want to go in**: YouTube is in the foreground
   without passing through the Shortcuts app.
7. Close and reopen YouTube before the access window expires. It stays in
   YouTube and does not reopen Still.
8. After the window expires, open YouTube, complete the ad and choose **I don't
   want to go in anymore**. Passes shows one more stored pass, and YouTube's
   counter is 2 with one avoided open.
9. With `iosHomeOnCancelEnabled` on, step 8 ends on the Home Screen, not in
   YouTube; reopening Still shows Today, not the old pause. With the flag off
   it ends on the **Done. You stayed out.** screen (or runs `Still - Inicio`
   when that helper shortcut was marked as installed).
10. In Airplane Mode with no stored pass, open YouTube:
    a 15-second countdown runs, the final options appear when it ends, and
    going in keeps YouTube open for five minutes only.
11. Configure the app outside the catalog including its `Still - [App name]`
    return shortcut. After the ad, **I want to go in** returns through Shortcuts
    and its counter starts at 1 instead of inheriting YouTube's count.
12. Remove YouTube in `/ios-apps` without touching Shortcuts and open YouTube:
    Still does not appear. Then publish `iosRestrictionEnabled = false`,
    foreground Still once, and confirm no chosen app opens Still either.

The flow passes only if all twelve observations match. Repeat the checklist on
the oldest supported iOS version, on iOS 26 and on iOS 27 before release, and
record the hypotheses H1–H9 in `docs/ios-shortcuts-v2-plan.md`.

## Platform limitations

- The chosen app is visible for an instant before Still. iOS launches it first
  and runs the automation right after; no third-party app can prevent that with
  Shortcuts.
- A rewarded ad cannot render inside Shortcuts. Google requires it to be
  presented from a foreground view controller and explicitly opted into, so
  Still must briefly come to the foreground and the ad starts with a tap.
- Still cannot create, edit or detect personal automations. "Connected" means
  the automation has fired at least once; a deleted automation is only noticed
  because the last pause gets old.
- iOS 26 and later move from the automation into Still without an extra
  confirmation. On iOS 16.4 through iOS 25, Apple shows a **Continue in Still**
  confirmation before foregrounding the app.
- iOS has no public API to return to the Home Screen. See the fallback chain in
  the runtime contract and the App Review notes in `docs/store-compliance.md`.
- Only one intervention can be pending at a time. If two chosen apps are opened
  within seconds of each other, the most recent one wins.
- iOS does not run automations for about two minutes after a restart.
- This mode disables Still's Managed Settings shields on iOS to prevent a
  Screen Time shield and a personal automation from competing. Android keeps
  its existing restriction engine.
- **A window that ends while the app is in front cannot be closed by Still.**
  iOS offers no API to background, cover or interrupt another app, and Shortcut
  mode knows the app only by the name the automation reported — there is no
  `ApplicationToken` to shield. What Still does instead is make the deadline
  real and visible: the allowance expires to the second and is never extended
  by continued use, a time-sensitive notification fires at that exact second,
  and the very next opening of the app is paused again. Enforcing the end of a
  window mid-session would require Family Controls authorisation plus the
  Family Activity Picker, which is decision D5 in
  `docs/ios-shortcuts-v2-plan.md` and is out of scope for Shortcut mode.
  Android has no such limit: see `docs/android-parity-plan.md` §12.
- "Delete local data" also clears the chosen apps. Automations that still exist
  in Shortcuts keep firing, and the intent adopts those apps again on their next
  opening.
