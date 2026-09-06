# Native feasibility gate

The current release is Android-only. The go/no-go decision requires signed Android physical-device runs and Google Play review. The iOS matrix below is retained only as a future reference and does not gate v1.

## Future iOS test matrix — out of v1 scope

Run on the minimum supported iOS 16.4 device and a current iOS 26 device after Apple approves Family Controls distribution for all five bundle IDs.

1. Authorize individual Family Controls and select a real app.
2. Confirm its Shield appears and “Ahora no” closes it.
3. Sync a local rewarded/emergency balance and a non-default remote duration, unlock, and confirm both the copy and deadline use that duration.
4. Terminate Still, wait for expiry, and confirm `DeviceActivityMonitorExtension` restores the Shield.
5. Reboot during a session and confirm the saved uptime/boot epoch cannot extend it.
6. Confirm the daily and seven-day report scenes render aggregate activity without exporting application tokens or detailed activity.
7. Disable `iosRestrictionEnabled` remotely, foreground Still, and confirm shields clear without deleting the on-device selection; re-enable it and confirm shields return.
8. Delete the account and confirm shields, monitoring schedules, App Group wallet/outbox, local notifications, and SQLite state are cleared.

Opening the main app directly from Shield is treated as best-effort. The implemented safe fallback records the pending opaque target and defers; React Native resolves the unlock when the user opens Still.

## Android test matrix

Run on Android 10, 12, 14, 15, and 16, including Pixel, Samsung, and Xiaomi.

Before completing the wider matrix, run the automated attribution regression on
an authorized USB-debug device with a debuggable Still build, Accessibility
enabled, and Gmail plus YouTube selected:

```bash
pnpm --filter mobile acceptance:shield
```

The gate launches Gmail, returns Home without destroying the intervention, then
launches YouTube. It asserts that the reused Shield changes to the exact current
app, displays that app's expected daily attempt, and increments both per-app
counters independently. It then taps the visible `Go back`/`Volver` control,
confirms that Android returns to the launcher instead of the blocked app, and
attributes the avoided open only to YouTube. Alternative installed apps can be
supplied explicitly:

```bash
pnpm --filter mobile acceptance:shield -- \
  com.example.first="First label" \
  com.example.second="Second label"
```

1. From the visual Android setup screen, enable the disclosed Accessibility
   service and select a launchable app. Usage Access is optional and only gates
   real foreground-time totals.
2. Confirm `TYPE_WINDOW_STATE_CHANGED` produces the intervention within one second.
3. Confirm “Ahora no” returns Home, clears the pending target, records the
   avoided opening for that app, and Back cannot bypass it.
4. From the React Native intervention, complete a rewarded ad or use a stored
   pass and confirm the package launch intent reopens the exact target without
   briefly re-shielding it.
5. Kill Still and verify detection remains active; reboot and confirm stale sessions no longer apply.
6. Disable Accessibility, revoke Usage Access, and uninstall a selected target; Settings must show a recoverable health state and open the relevant system control.
7. Disable `androidRestrictionEnabled` remotely, foreground Still, and confirm the service stops intervening while preserving the local selection; re-enable it and confirm detection returns.
8. Delete the account and confirm local selections, sessions, wallet projection, and SQLite state are cleared.

The implementation deliberately excludes overlays, Device Owner, `QUERY_ALL_PACKAGES`, and permanent foreground services. If recent Android/OEM behavior prevents `InterventionActivity` from appearing and a Play-incompatible permission is the only workaround, Android is a no-go.

## What compilation cannot prove for Android v1

- Play must accept the Accessibility disclosure and evidence; individual OEMs may still suppress the intervention activity.
- AdMob SSV timing, reboot restoration, and real store signing require account-backed Android physical-device tests.

## Gate record

Record device, OS build, detection latency, reblock result, evidence video, and reviewer notes for every Android row. External beta remains closed until the Android rows pass and the Play declaration is accepted. Apple membership and iOS distribution are not required for v1.
