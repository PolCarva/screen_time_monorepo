# iOS Shortcuts pause flow

Still uses a personal automation on iOS to learn which app the user opened and
to return to that same app after the decision. Apple does not expose another
app's bundle identifier to Still and personal automations cannot be installed
programmatically, so setup remains entirely on the user's iPhone.

## Configure one app

For YouTube, for example:

1. From Still's setup screen, tap **Create return shortcut** and name it
   `Still · YouTube`.
2. Give it one action: **Open App → YouTube**.
3. In the Automation tab, create a personal automation with **App → YouTube →
   Is Opened**.
4. Select **Run Immediately**.
5. Add Still's **Pause Before Opening** action.
6. Set **App name** to `YouTube`. Still derives the return shortcut name
   `Still · YouTube` automatically, so there is no second field to configure.

Repeat these steps for every app that needs a pause. The app name and return
shortcut name never leave the device.

## Runtime contract

1. Opening YouTube triggers `PauseBeforeOpeningIntent`.
2. If YouTube already has an active allowance, the intent finishes in the
   background and the app remains visible.
3. Otherwise the intent stores an app-scoped intervention and conditionally
   brings Still to the foreground.
4. Still offers the prepared rewarded ad directly. A stored pass or Emergency
   Access is used only when a direct ad is unavailable or capped.
5. Once the reward is accepted, Still records the unlock, starts the app-scoped
   allowance and runs `shortcuts://run-shortcut?name=Still · YouTube`.
6. The return shortcut opens YouTube. Its automation fires again, sees the
   active allowance and does not reopen Still until that allowance expires.

Choosing **Go back** cancels the pending intervention and records an avoided
open. It does not run the return shortcut.

## Physical release acceptance

First verify the compiled app contract. The command checks that Shortcuts can
discover the action, its single app-specific parameter is present, Still only
foregrounds dynamically, and the production iOS AdMob application id reached
the bundle:

```sh
pnpm --filter mobile acceptance:ios-shortcuts -- /absolute/path/to/Still.app
```

This build gate complements rather than replaces the device test below.

Run this checklist on an iPhone after installing the native build:

1. Open Still once and confirm Settings shows **Shortcut mode is active**.
2. Configure YouTube using the six steps above, then open YouTube.
3. Confirm Still shows `YouTube opened 1 time today` and offers **Watch ad ·
   Open YouTube** without first navigating to Passes.
4. Choose **Go back**, open YouTube again, and confirm its counter becomes 2.
5. Complete the ad and confirm the return shortcut leaves YouTube in the
   foreground.
6. Close and reopen YouTube before the access window expires. Confirm it stays
   in YouTube and does not reopen Still.
7. Configure and open a second app. Confirm its counter starts at 1 rather than
   inheriting YouTube's count.
8. Confirm an app previously selected in Screen Time no longer shows the old
   Managed Settings shield while Shortcut mode is active.

The flow passes only if all eight observations match. Repeat the checklist for
the oldest supported iOS version and iOS 26 before release.

## Platform limitations

- A rewarded ad cannot render inside Shortcuts. Google requires it to be
  presented from a foreground view controller and explicitly opted into, so
  Still must briefly come to the foreground.
- Still cannot create or edit personal automations. iOS requires the user to
  choose the app and approve **Run Immediately** in Shortcuts.
- iOS 26 can move from the automation into Still without an extra confirmation.
  On iOS 16.4 through iOS 25, Apple shows a **Continue in Still** confirmation
  before foregrounding the app.
- The separate return shortcut is intentional: Shortcuts' **Open App** action
  can reopen any installed app, including apps without a public URL scheme.
  Still standardizes its name as `Still · [App name]`, so the personal
  automation asks for only one value.
- This mode disables Still's Managed Settings shields on iOS to prevent a
  Screen Time shield and a personal automation from competing. Android keeps
  its existing restriction engine.
