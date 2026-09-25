package com.still.screentime

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings

/**
 * What the onboarding's verified setup needs from the native side
 * (docs/onboarding-v2-plan.md §4.3, §6.2, §6.4): a real test of the pause that
 * counts nothing, bringing Still back once Accessibility is on, and the
 * battery check. Every step is proven by a signal read here, never by the
 * wording of a Settings screen, which differs from phone to phone.
 */
object StillSetup {
  /** The chosen app a setup test is waiting for, and until when (wall clock). */
  const val KEY_PROBE_PACKAGE = "setup_probe_package"
  const val KEY_PROBE_UNTIL = "setup_probe_until"
  /** When the pause showed in test mode (epoch ms); proof the whole chain works. */
  const val KEY_PROBE_VERIFIED_AT = "setup_probe_verified_at"
  /** Settings was opened for this step; the service brings Still back once it holds. */
  const val KEY_AWAITING = "setup_awaiting"
  const val KEY_AWAITING_UNTIL = "setup_awaiting_until"
  const val AWAITING_ACCESSIBILITY = "accessibility"

  /** A test lasts two minutes, like the iOS one. */
  private const val PROBE_MS = 120_000L
  private const val AWAITING_MS = 10 * 60_000L

  fun beginProbe(preferences: SharedPreferences, packageName: String): Long {
    val now = System.currentTimeMillis()
    preferences.edit()
      .putString(KEY_PROBE_PACKAGE, packageName)
      .putLong(KEY_PROBE_UNTIL, now + PROBE_MS)
      .remove(KEY_PROBE_VERIFIED_AT)
      .apply()
    return now
  }

  /** The package a live test waits for, or null. */
  fun probePackage(preferences: SharedPreferences): String? {
    val target = preferences.getString(KEY_PROBE_PACKAGE, null) ?: return null
    if (System.currentTimeMillis() > preferences.getLong(KEY_PROBE_UNTIL, 0)) return null
    return target
  }

  /** The pause showed in test mode: record it and end the test. */
  fun markProbeShown(preferences: SharedPreferences) {
    preferences.edit()
      .putLong(KEY_PROBE_VERIFIED_AT, System.currentTimeMillis())
      .remove(KEY_PROBE_PACKAGE)
      .remove(KEY_PROBE_UNTIL)
      .apply()
  }

  fun setAwaiting(preferences: SharedPreferences, step: String?) {
    if (step == null) {
      preferences.edit().remove(KEY_AWAITING).remove(KEY_AWAITING_UNTIL).apply()
      return
    }
    preferences.edit()
      .putString(KEY_AWAITING, step)
      .putLong(KEY_AWAITING_UNTIL, System.currentTimeMillis() + AWAITING_MS)
      .apply()
  }

  /** Consumes a pending wait for [step]; true if it was live. */
  fun consumeAwaiting(preferences: SharedPreferences, step: String): Boolean {
    val waiting = preferences.getString(KEY_AWAITING, null) == step &&
      System.currentTimeMillis() <= preferences.getLong(KEY_AWAITING_UNTIL, 0)
    if (waiting) setAwaiting(preferences, null)
    return waiting
  }

  /**
   * Brings Still's own screen back to the front. From the accessibility
   * service this is allowed while the service is bound (HA5); from the shield
   * it is a normal foreground start.
   */
  fun bringStillToFront(context: Context) {
    val intent = context.packageManager.getLaunchIntentForPackage(context.packageName)
      ?: return
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
    runCatching { context.startActivity(intent) }
  }

  /**
   * Opens Accessibility as close to Still's own switch as the phone allows:
   * Still's page on Android 12+ (HA3), else the list with Still's row
   * highlighted (HA2), else the plain list.
   */
  fun openAccessibilitySettings(context: Context, starter: (Intent) -> Unit): Boolean {
    val component = ComponentName(context, StillAccessibilityService::class.java).flattenToString()
    val attempts = buildList {
      if (android.os.Build.VERSION.SDK_INT >= 31) {
        // Not in the public SDK; the action string is what Settings listens for.
        add(
          Intent("android.settings.ACCESSIBILITY_DETAILS_SETTINGS")
            .putExtra(Intent.EXTRA_COMPONENT_NAME, component),
        )
      }
      add(
        Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
          .putExtra(":settings:fragment_args_key", component)
          .putExtra(
            ":settings:show_fragment_args",
            Bundle().apply { putString(":settings:fragment_args_key", component) },
          ),
      )
      add(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
    }
    return attempts.any { intent -> runCatching { starter(intent) }.isSuccess }
  }

  fun isIgnoringBatteryOptimizations(context: Context): Boolean {
    val power = context.getSystemService(Context.POWER_SERVICE) as PowerManager
    return power.isIgnoringBatteryOptimizations(context.packageName)
  }

  /**
   * The battery list where the user sets Still to "not optimized", without the
   * REQUEST_IGNORE_BATTERY_OPTIMIZATIONS permission Play restricts; Still's App
   * info when a maker hides that list.
   */
  fun openBatterySettings(context: Context, starter: (Intent) -> Unit): Boolean {
    val attempts = listOf(
      Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS),
      Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
        .setData(android.net.Uri.fromParts("package", context.packageName, null)),
    )
    return attempts.any { intent -> runCatching { starter(intent) }.isSuccess }
  }
}
