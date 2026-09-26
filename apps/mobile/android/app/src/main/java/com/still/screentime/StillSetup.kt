package com.still.screentime

import android.app.ActivityManager
import android.app.AppOpsManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.os.Process
import android.provider.Settings
import android.util.Log

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
      appInfo(context),
    )
    return attempts.any { intent -> runCatching { starter(intent) }.isSuccess }
  }

  /**
   * Opens the screen where one "keep Still running" tip is done, so every tip
   * has its own way there (src/lib/android-oem.ts):
   * - appInfo: Still's App info (Autostart and battery on Xiaomi, battery on
   *   Samsung);
   * - battery: the battery list, as [openBatterySettings];
   * - autostart: the maker's autostart list (Huawei, OPPO, vivo);
   * - popups: MIUI's "Other permissions" for Still (pop-ups in the background);
   * - recents: the Recents screen, through the running service.
   * Makers move their screens between versions, so each list ends in Still's
   * App info, which every phone has.
   */
  fun openKeepAliveSetting(context: Context, target: String, starter: (Intent) -> Unit): Boolean {
    when (target) {
      "recents" -> return StillAccessibilityService.openRecents()
      "battery" -> return openBatterySettings(context, starter)
    }
    val attempts = buildList {
      if (target == "autostart") {
        AUTOSTART_SCREENS.forEach { (pkg, cls) -> add(Intent().setClassName(pkg, cls)) }
      }
      if (target == "popups") {
        MIUI_PERMISSION_EDITORS.forEach { cls ->
          add(
            Intent("miui.intent.action.APP_PERM_EDITOR")
              .setClassName("com.miui.securitycenter", cls)
              .putExtra("extra_pkgname", context.packageName),
          )
        }
      }
      add(appInfo(context))
    }
    return attempts.any { intent -> runCatching { starter(intent) }.isSuccess }
  }

  /**
   * MIUI / HyperOS "Autostart" for Still: "allowed", "denied", or "unknown" on
   * other makers or when the phone does not say. Without it, closing Still
   * from Recents (SwipeUpClean) kills it and Android never restarts the
   * accessibility service; with it the service is back in about a second
   * (docs/android-parity-plan.md §15). No public API reads it: this asks for
   * MIUI's app op 10008, the value `adb shell appops get` shows as MIUIOP(10008).
   */
  fun autostartState(context: Context): String {
    if (!isXiaomi()) return AUTOSTART_UNKNOWN
    val mode = runCatching {
      val appOps = context.getSystemService(AppOpsManager::class.java)
      val check = AppOpsManager::class.java.getMethod(
        "checkOpNoThrow",
        Int::class.javaPrimitiveType,
        Int::class.javaPrimitiveType,
        String::class.java,
      )
      check.invoke(appOps, OP_MIUI_AUTOSTART, Process.myUid(), context.packageName) as Int
    }.recoverCatching {
      // Older MIUI: its own helper answers 0 when Autostart is on.
      val utils = Class.forName("android.miui.AppOpsUtils")
      val get = utils.getMethod("getApplicationAutoStart", Context::class.java, String::class.java)
      if (get.invoke(null, context, context.packageName) as Int == 0) AppOpsManager.MODE_ALLOWED
      else AppOpsManager.MODE_IGNORED
    }.onFailure { Log.w(TAG, "Autostart state unavailable", it) }
      .getOrNull()
    val state = when (mode) {
      AppOpsManager.MODE_ALLOWED -> AUTOSTART_ALLOWED
      AppOpsManager.MODE_IGNORED, AppOpsManager.MODE_ERRORED -> AUTOSTART_DENIED
      else -> AUTOSTART_UNKNOWN
    }
    if (state != lastAutostartLogged) {
      Log.i(TAG, "Autostart: $state (mode $mode)")
      lastAutostartLogged = state
    }
    return state
  }

  /**
   * Keeps Still's tasks out of Recents while Autostart is off, so the card
   * that would kill it for good is not there to swipe (§15); back in Recents
   * the moment Still is on screen again. Other phones are left alone.
   */
  fun updateRecentsPresence(context: Context, onScreen: Boolean) {
    val hide = !onScreen && autostartState(context) == AUTOSTART_DENIED
    val manager = context.getSystemService(ActivityManager::class.java) ?: return
    runCatching {
      manager.appTasks.forEach { task ->
        // The shield's own task never shows in Recents.
        val base = runCatching { task.taskInfo.baseIntent.component?.className }.getOrNull()
        if (base != InterventionActivity::class.java.name) task.setExcludeFromRecents(hide)
      }
    }.onFailure { Log.w(TAG, "Recents presence not updated", it) }
  }

  private fun isXiaomi(): Boolean {
    val maker = "${Build.MANUFACTURER} ${Build.BRAND}".lowercase()
    return XIAOMI_BRANDS.any { maker.contains(it) }
  }

  const val AUTOSTART_ALLOWED = "allowed"
  const val AUTOSTART_DENIED = "denied"
  const val AUTOSTART_UNKNOWN = "unknown"
  private const val OP_MIUI_AUTOSTART = 10008
  @Volatile private var lastAutostartLogged: String? = null
  private val XIAOMI_BRANDS = listOf("xiaomi", "redmi", "poco")
  private const val TAG = "StillSetup"

  private fun appInfo(context: Context) =
    Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
      .setData(android.net.Uri.fromParts("package", context.packageName, null))

  /** Known autostart lists, newest first; a missing one throws and the next is tried. */
  private val AUTOSTART_SCREENS = listOf(
    "com.huawei.systemmanager" to "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity",
    "com.coloros.safecenter" to "com.coloros.safecenter.startupapp.StartupAppListActivity",
    "com.oplus.safecenter" to "com.oplus.safecenter.startupapp.StartupAppListActivity",
    "com.coloros.safecenter" to "com.coloros.safecenter.permission.startup.StartupAppListActivity",
    "com.vivo.permissionmanager" to "com.vivo.permissionmanager.activity.BgStartUpManagerActivity",
    "com.iqoo.secure" to "com.iqoo.secure.ui.phoneoptimize.BgStartUpManager",
  )

  /** MIUI / HyperOS "Other permissions" for one app, newest first. */
  private val MIUI_PERMISSION_EDITORS = listOf(
    "com.miui.permcenter.permissions.PermissionsEditorActivity",
    "com.miui.permcenter.permissions.AppPermissionsEditorActivity",
  )
}
