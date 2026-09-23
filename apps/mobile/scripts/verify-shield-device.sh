#!/usr/bin/env bash
# Phase 8 device validation for the Android pause flow (docs/android-parity-plan.md §10).
# Runs the whole real-device checklist in one command: install, enable accessibility
# (best effort on MIUI), seed apps, acceptance:shield, and time
# "open app -> shield -> ad visible" cold and warm.
#
# Usage: bash apps/mobile/scripts/verify-shield-device.sh <serial>
# Get <serial> from `adb devices`. Needs the debug APK built:
#   pnpm --filter mobile android   (or: cd android && ./gradlew :app:assembleDebug)
set -u
S="${1:?serial required (adb devices)}"
SDK="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
ADB="$SDK/platform-tools/adb"
STILL=com.still.screentime
HERE="$(cd "$(dirname "$0")/.." && pwd)"        # apps/mobile
APK="$HERE/android/app/build/outputs/apk/debug/app-debug.apk"
adbx() { "$ADB" -s "$S" "$@"; }
say() { printf '\n=== %s ===\n' "$*"; }

[ -f "$APK" ] || { echo "Missing $APK — build it first (pnpm --filter mobile android)"; exit 1; }

say "device"
adbx shell getprop ro.product.manufacturer; adbx shell getprop ro.product.model; adbx shell getprop ro.build.version.release

say "install"
adbx uninstall "$STILL" >/dev/null 2>&1 || true
adbx install -r "$APK" | tail -1

say "install source (restricted-settings heuristic: 3/4 = restricted)"
adbx shell dumpsys package "$STILL" | grep -E "packageSource|installerPackageName" | head -2

say "enable accessibility (MIUI may block adb-enable; then do it by hand)"
adbx shell settings put secure enabled_accessibility_services "$STILL/$STILL.StillAccessibilityService"
adbx shell settings put secure accessibility_enabled 1
sleep 4
BOUND=$(adbx shell "dumpsys accessibility | grep -c 'Bound services:{Service'" | tr -d '\r')
echo "accessibility bound: $BOUND"
if [ "${BOUND:-0}" -lt 1 ]; then
  echo "MIUI/OEM blocked adb-enable. Enable Still manually: Settings > Accessibility > Still (allow restricted settings first if greyed). Then re-run."
  exit 2
fi

say "seed apps (Gmail + YouTube) and a pre-signed intent so tap->ad can be timed"
FUTURE=$(python3 -c "import datetime;print((datetime.datetime.now(datetime.timezone.utc)+datetime.timedelta(minutes=14)).isoformat().replace('+00:00','Z'))")
adbx shell run-as "$STILL" mkdir -p shared_prefs
adbx shell "run-as $STILL sh -c 'cat > shared_prefs/still_restrictions.xml'" <<XML
<?xml version='1.0' encoding='utf-8' standalone='yes' ?>
<map>
    <int name="unlock_duration_seconds" value="600" />
    <float name="estimated_minutes_per_avoided_open" value="2.0" />
    <int name="rewarded_balance" value="0" />
    <string name="wallet_reset_at">2099-01-01T00:00:00.000Z</string>
    <boolean name="restrictions_enabled" value="true" />
    <boolean name="ads_eligible" value="true" />
    <string name="reward_provider">admob</string>
    <string name="admob_rewarded_unit">ca-app-pub-3940256099942544/5224354917</string>
    <string name="presigned_reward_intents">[{&quot;id&quot;:&quot;44444444-4444-4444-8444-444444444444&quot;,&quot;customData&quot;:&quot;signed-custom-data-device-run&quot;,&quot;userId&quot;:&quot;anonymous&quot;,&quot;expiresAt&quot;:&quot;$FUTURE&quot;}]</string>
    <set name="selected_packages">
        <string>com.google.android.gm</string>
        <string>com.google.android.youtube</string>
    </set>
</map>
XML
adbx shell am force-stop "$STILL"; sleep 1
adbx shell settings put secure enabled_accessibility_services "$STILL/$STILL.StillAccessibilityService"
adbx shell settings put secure accessibility_enabled 1
sleep 6   # let the service reload prefs and preload the ad

say "acceptance:shield (default Gmail + YouTube)"
( cd "$HERE" && ANDROID_SERIAL="$S" node scripts/verify-shield-attribution.mjs 2>&1 | tail -8 )

time_open() {  # $1 = warm|cold
  local mode="$1"
  if [ "$mode" = cold ]; then
    adbx shell am force-stop "$STILL"; sleep 1
    adbx shell settings put secure enabled_accessibility_services "$STILL/$STILL.StillAccessibilityService"
    adbx shell settings put secure accessibility_enabled 1; sleep 5
  fi
  adbx shell am force-stop com.google.android.youtube
  adbx shell input keyevent KEYCODE_HOME; sleep 1
  adbx logcat -c
  adbx shell am start -W -a android.intent.action.MAIN -c android.intent.category.LAUNCHER -p com.google.android.youtube | grep -E "TotalTime" | sed "s/^/[$mode] /"
  sleep 4
  adbx logcat -d -v epoch 2>/dev/null | grep -E "Displayed com.(google.android.youtube|still.screentime)" | sed "s/^/[$mode] /" | cut -c1-140
  adbx shell input keyevent KEYCODE_BACK; sleep 1; adbx shell input keyevent KEYCODE_HOME; sleep 1
}
say "timing: open app -> shield (cold)"; time_open cold
say "timing: open app -> shield (warm)"; time_open warm

say "timing: tap Watch ad -> ad visible (uses the seeded pre-signed intent)"
adbx shell am force-stop com.google.android.youtube; adbx shell input keyevent KEYCODE_HOME; sleep 1
adbx shell am start -a android.intent.action.MAIN -c android.intent.category.LAUNCHER -p com.google.android.youtube >/dev/null 2>&1; sleep 3
adbx shell uiautomator dump /sdcard/still-ui.xml >/dev/null 2>&1
XY=$(adbx exec-out cat /sdcard/still-ui.xml | python3 -c "import re,sys
x=sys.stdin.read()
for m in re.finditer(r'<node[^>]*>',x):
    n=m.group(0); t=re.search(r'text=\"([^\"]*)\"',n)
    if t and ('Watch ad' in t.group(1) or 'Ver anuncio' in t.group(1)):
        b=re.search(r'bounds=\"\[(\d+),(\d+)\]\[(\d+),(\d+)\]\"',n)
        print((int(b.group(1))+int(b.group(3)))//2,(int(b.group(2))+int(b.group(4)))//2); break")
if [ -n "$XY" ]; then
  adbx logcat -c; adbx shell input tap $XY; sleep 3
  adbx logcat -d -v epoch 2>/dev/null | grep "AdActivity for user 0" | tail -1 | cut -c1-140
  adbx shell "dumpsys activity activities | grep topResumedActivity" | cut -c1-110
else
  echo "Shield did not offer 'Watch ad' (no ad fill or ads not eligible). A saved pass or the 15s pause applies."
fi

say "OEM background note"
echo "Manufacturer: $(adbx shell getprop ro.product.manufacturer). See docs/android-parity-plan.md §6.4 for the per-OEM steps (autostart, battery, pop-up windows)."
say "DONE — app left installed for manual inspection"
