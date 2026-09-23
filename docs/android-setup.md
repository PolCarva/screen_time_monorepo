# Android setup and intervention flow

Android does not need one automation per app. Still uses its disclosed
Accessibility service to detect when a locally selected app reaches the
foreground, then opens the native pause for that exact package.

## What the user must configure

Only two actions are required:

1. In Android Accessibility settings, open **Still** and switch it on.
2. Back in Still's private app picker, select at least one app and tap **Done**.

The in-app **Activate Still and choose apps** button runs these steps as one
progressive flow: it opens the system permission first and, when the user
returns, opens app selection automatically.

Under the first step, the setup screen shows the three Accessibility screens
the user will see (the Still row, the **Use Still** switch and the
**Allow** confirmation), drawn in code from Android 14's Settings in the
phone's language (`src/components/guide/android-settings-screens.tsx`), with
the control to tap ringed. Tapping one runs the same flow as the button.

Today counts Still's own pauses per local day, the same as on iOS. Still does
not ask for Usage Access.

## What happens when a selected app opens

1. `StillAccessibilityService` receives the foreground package and verifies it
   is selected and not temporarily unlocked.
2. It increments the total counter and that package's own daily counter, saves
   the exact package as the current target, and opens `InterventionActivity`.
3. **Go back** records an avoided opening for that package and launches Android
   Home. It never navigates back into the blocked app.
4. **Watch ad** opens Still's rewarded-ad decision screen. After the reward is
   confirmed, the native module grants the time window and launches the exact
   saved package with its normal launch intent.
5. A saved pass ("Usar 1 pase de emergencia", small and muted under "Ver
   anuncio") uses the same exact-package launch path and never has to wait for
   an ad. When the time window expires, the next opening is paused again.

If Android cannot resolve or launch the saved package, the native module rejects
the operation and rolls back the temporary allowance before a pass is spent.

## Physical-device acceptance check

1. Complete the two required setup steps with Gmail and YouTube selected.
2. Open Gmail and confirm the heading and daily number name Gmail.
3. Tap **Go back** and confirm Android Home appears without another Still loop.
4. Open YouTube and confirm its own heading and daily number are independent.
5. Tap **Watch ad**, earn the reward, choose how long, and confirm Android
   returns directly to YouTube for that time.
6. Return to Still and verify Today counts both pauses: one **Didn't go in**
   (Gmail) and one **Went in** (YouTube).

For an attached debug device, the attribution portion can also be run with:

```bash
pnpm --filter mobile acceptance:shield
```
