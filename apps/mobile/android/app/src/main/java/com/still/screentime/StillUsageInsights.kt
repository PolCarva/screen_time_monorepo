package com.still.screentime

import android.app.AppOpsManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.net.Uri
import android.os.Process
import android.provider.Settings
import android.util.Base64
import java.io.ByteArrayOutputStream
import java.time.LocalDate
import java.time.ZoneId

/**
 * Reads how the phone was used, for the onboarding story only
 * (docs/onboarding-v2-plan.md, D4). Everything is computed here, returned to
 * React Native once and forgotten: nothing is stored and nothing leaves the
 * phone. This is the only file that touches `UsageStatsManager`.
 */
object StillUsageInsights {
  /** Complete days before today that the story averages. */
  const val DAYS = 7
  /** Apps returned with per-day time; React Native keeps the top five. */
  private const val TOP_APPS = 10

  fun hasUsageAccess(context: Context): Boolean {
    val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
    return appOps.unsafeCheckOpNoThrow(
      AppOpsManager.OPSTR_GET_USAGE_STATS,
      Process.myUid(),
      context.packageName,
    ) == AppOpsManager.MODE_ALLOWED
  }

  /**
   * Opens Usage access at Still's own row where the phone supports it (HA1),
   * else the list, else Still's App info. Returns whether anything opened.
   */
  fun openUsageAccessSettings(context: Context, starter: (Intent) -> Unit): Boolean {
    val attempts = listOf(
      Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)
        .setData(Uri.fromParts("package", context.packageName, null)),
      Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS),
      Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
        .setData(Uri.fromParts("package", context.packageName, null)),
    )
    return attempts.any { intent -> runCatching { starter(intent) }.isSuccess }
  }

  data class Summary(
    /** Seven complete days, then today; oldest first. */
    val days: List<UsageSessions.Day>,
    val todayIndex: Int,
    val apps: List<Pair<String, String>>,
  )

  fun readSummary(context: Context, zone: ZoneId = ZoneId.systemDefault()): Summary {
    val today = LocalDate.now(zone)
    val days = (DAYS downTo 0).map { today.minusDays(it.toLong()) }
    val start = days.first().atStartOfDay(zone).toInstant().toEpochMilli()
    val now = System.currentTimeMillis()
    val manager = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
    val raw = manager.queryEvents(start, now)
    val event = UsageEvents.Event()
    val events = mutableListOf<UsageSessions.Event>()
    while (raw.hasNextEvent()) {
      raw.getNextEvent(event)
      val kind = when (event.eventType) {
        UsageEvents.Event.ACTIVITY_RESUMED -> UsageSessions.Kind.RESUMED
        UsageEvents.Event.ACTIVITY_PAUSED,
        UsageEvents.Event.ACTIVITY_STOPPED -> UsageSessions.Kind.PAUSED
        UsageEvents.Event.SCREEN_INTERACTIVE -> UsageSessions.Kind.SCREEN_ON
        UsageEvents.Event.SCREEN_NON_INTERACTIVE -> UsageSessions.Kind.SCREEN_OFF
        UsageEvents.Event.KEYGUARD_SHOWN -> UsageSessions.Kind.LOCKED
        UsageEvents.Event.KEYGUARD_HIDDEN -> UsageSessions.Kind.UNLOCKED
        UsageEvents.Event.DEVICE_SHUTDOWN -> UsageSessions.Kind.SHUTDOWN
        else -> null
      } ?: continue
      events += UsageSessions.Event(event.timeStamp, kind, event.packageName, event.className)
    }
    val launchable = launchablePackages(context)
    val home = homePackages(context)
    // Settings is where the onboarding itself sends the user (usage access,
    // Accessibility): its time says nothing about habits and it is never an
    // app to pause.
    val excluded: (String) -> Boolean = { packageName ->
      packageName == context.packageName ||
        packageName == "com.android.systemui" ||
        packageName == "com.android.settings" ||
        packageName in home ||
        packageName !in launchable
    }
    val summary = UsageSessions.summarize(events, days, zone, now, excluded)
    val totals = mutableMapOf<String, Long>()
    for (day in summary) {
      for ((packageName, millis) in day.appMillis) {
        totals[packageName] = (totals[packageName] ?: 0L) + millis
      }
    }
    val apps = totals.entries
      .sortedByDescending { it.value }
      .take(TOP_APPS)
      .map { (packageName, _) -> packageName to label(context, packageName) }
    return Summary(summary, summary.lastIndex, apps)
  }

  /** The app's icon as a PNG `data:` URI, or null if the app is gone. */
  fun iconDataUri(context: Context, packageName: String, sizePx: Int): String? {
    val drawable = runCatching { context.packageManager.getApplicationIcon(packageName) }
      .getOrNull() ?: return null
    val bitmap = Bitmap.createBitmap(sizePx, sizePx, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)
    drawable.setBounds(0, 0, sizePx, sizePx)
    drawable.draw(canvas)
    val bytes = ByteArrayOutputStream().use { stream ->
      bitmap.compress(Bitmap.CompressFormat.PNG, 100, stream)
      stream.toByteArray()
    }
    bitmap.recycle()
    return "data:image/png;base64," + Base64.encodeToString(bytes, Base64.NO_WRAP)
  }

  private fun label(context: Context, packageName: String): String =
    runCatching {
      val info = context.packageManager.getApplicationInfo(packageName, 0)
      context.packageManager.getApplicationLabel(info).toString()
    }.getOrDefault(packageName)

  private fun launchablePackages(context: Context): Set<String> {
    val intent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
    return context.packageManager
      .queryIntentActivities(intent, PackageManager.MATCH_ALL)
      .mapNotNull { it.activityInfo?.packageName }
      .toSet()
  }

  /** Launchers: time on the home screen is not time in an app. Settings'
   *  fallback home activity does not make Settings a launcher. */
  private fun homePackages(context: Context): Set<String> {
    val intent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME)
    return context.packageManager
      .queryIntentActivities(intent, PackageManager.MATCH_ALL)
      .mapNotNull { it.activityInfo?.packageName }
      .filterNot { it == "com.android.settings" }
      .toSet()
  }
}
