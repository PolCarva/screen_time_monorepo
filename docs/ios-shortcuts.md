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

1. **Choose apps in Still** (`/ios-apps`). Catalog apps that are installed are
   listed first; any other app can be added by name. The choice never leaves
   the device.
2. **Connect Shortcuts** (`/shortcut-setup`). Still picks the easiest tier the
   device supports:

   | Tier | iOS | Steps | Status |
   | --- | --- | --- | --- |
   | Import | 27+ | Add a shared shortcut, pick the apps in its trigger, flip its switch | Off until H2 is validated |
   | Single automation | 18.2–26 | One automation for every app using **Get Current App** | Off until H1 is validated |
   | Per app | 16.4+ | One automation per app | **Active** |

   The per-app tier, for YouTube:

   1. Shortcuts → Automation → **+** → **App**.
   2. Select only **YouTube**, keep **Is Opened**.
   3. Choose **Run Immediately** and turn off **Notify When Run**.
   4. Add Still's **Pause Before Opening** action and pick **YouTube** from the
      list. There is nothing to type.

   Apps outside the catalog have no URL scheme Still can open, so they need one
   more step: a shortcut named exactly `Still · [App name]` with a single
   **Open App** action.

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
5. Still shows the gate: **Watch ad** or **I don't want to go in anymore**. On
   a cold start it waits up to 12 seconds for AdMob. A stored pass or Emergency
   Access is offered only when a direct ad is unavailable, times out or is
   capped; when none of those exist, a 15-second pause takes over.
6. Only after the ad is completed and the reward is confirmed do the two final
   options appear: **I want to go in** / **I don't want to go in anymore**.
   Closing the ad early returns to the gate with no penalty and no reward.
7. **I want to go in** records the unlock, starts the app-scoped allowance and
   opens `youtube://`. If that scheme fails, Still runs
   `shortcuts://run-shortcut?name=Still · YouTube` instead and stops offering
   the scheme on that device. YouTube's automation fires again, sees the
   allowance and does not reopen Still until it expires. An unlock earned with
   the 15-second pause lasts five minutes, spends nothing and is not reported.
8. **I don't want to go in anymore** cancels the intervention and records an
   avoided open. A reward already earned is kept as a stored pass. Still then
   leaves to the Home Screen through a fallback chain: the native suspend call
   when the remote `iosHomeOnCancelEnabled` flag is on, else the helper shortcut
   `Still · Inicio` when the user installed it, else a hint to swipe up.

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
Still as options, that Still only foregrounds dynamically, and that the
production iOS AdMob application id reached the bundle:

```sh
pnpm --filter mobile acceptance:ios-shortcuts -- /absolute/path/to/Still.app
```

This build gate complements rather than replaces the device test below.

## Physical release acceptance

None of these have been observed yet. Run the checklist on an iPhone after
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
   it ends on the **Done. You stayed out.** screen (or runs `Still · Inicio`
   when that helper shortcut was marked as installed).
10. In Airplane Mode with no stored pass and no Emergency Access, open YouTube:
    a 15-second countdown runs, the final options appear when it ends, and
    going in keeps YouTube open for five minutes only.
11. Configure the app outside the catalog including its `Still · [App name]`
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
- "Delete local data" also clears the chosen apps. Automations that still exist
  in Shortcuts keep firing, and the intent adopts those apps again on their next
  opening.
