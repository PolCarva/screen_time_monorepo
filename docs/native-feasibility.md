# Native feasibility gate

The repository implements both spike candidates, but the go/no-go decision still requires signed physical-device runs and store-account review.

## iOS test matrix

Run on the minimum supported iOS 16.4 device and a current iOS 26 device after Apple approves Family Controls distribution for all five bundle IDs.

1. Authorize individual Family Controls and select a real app.
2. Confirm its Shield appears and “Ahora no” closes it.
3. Sync a local rewarded/emergency balance, unlock for ten minutes, and confirm the target is unshielded.
4. Terminate Still, wait for expiry, and confirm `DeviceActivityMonitorExtension` restores the Shield.
5. Reboot during a session and confirm the saved uptime/boot epoch cannot extend it.
6. Confirm the report extension renders aggregate activity without exporting application tokens or detailed activity.

Opening the main app directly from Shield is treated as best-effort. The implemented safe fallback records the pending opaque target and defers; React Native resolves the unlock when the user opens Still.

## Android test matrix

Run on Android 10, 12, 14, 15, and 16, including Pixel, Samsung, and Xiaomi.

1. Enable the disclosed Accessibility service and select a launchable app.
2. Confirm `TYPE_WINDOW_STATE_CHANGED` produces the intervention within one second.
3. Confirm “Ahora no” returns Home and Back cannot bypass it.
4. Unlock and confirm the package launch intent reopens the target.
5. Kill Still and verify detection remains active; reboot and confirm stale sessions no longer apply.
6. Disable Accessibility, revoke Usage Access, and uninstall a selected target; Settings must show recoverable health state.

The implementation deliberately excludes overlays, Device Owner, `QUERY_ALL_PACKAGES`, and permanent foreground services. If recent Android/OEM behavior prevents `InterventionActivity` from appearing and a Play-incompatible permission is the only workaround, Android is a no-go.

## Gate record

Record device, OS build, detection latency, reblock result, evidence video, and reviewer notes for every row. External beta remains closed until all rows pass and both platform declarations are accepted.

