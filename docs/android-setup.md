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

**Usage Access is optional.** Enabling it adds Android's real foreground-time
totals. Accessibility alone still supports pauses, direct return, and the
individual open/avoided/unlock counters used by the intervention.

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
5. A stored rewarded pass or Emergency Access uses the same exact-package
   launch path. When the time window expires, the next opening is paused again.

If Android cannot resolve or launch the saved package, the native module rejects
the operation and rolls back the temporary allowance before a pass is spent.

## Physical-device acceptance check

1. Complete the two required setup steps with Gmail and YouTube selected.
2. Open Gmail and confirm the heading and daily number name Gmail.
3. Tap **Go back** and confirm Android Home appears without another Still loop.
4. Open YouTube and confirm its own heading and daily number are independent.
5. Tap **Watch ad**, earn the reward, and confirm Android returns directly to
   YouTube for the duration configured in Settings.
6. Return to Still and verify Today shows the updated per-app activity.
7. Optionally enable Usage Access and verify the real screen-time total changes
   after using one of the selected apps.

For an attached debug device, the attribution portion can also be run with:

```bash
pnpm --filter mobile acceptance:shield
```
