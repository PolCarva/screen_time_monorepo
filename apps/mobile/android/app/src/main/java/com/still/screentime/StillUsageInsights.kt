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
 * Reads how the phone was used: for the onboarding story
 * (docs/onboarding-v2-plan.md) and for the time each skipped pause gives back
 * (docs/real-savings-estimate-plan.md). Everything is computed here and handed
 * to React Native, which keeps only per-app totals on the phone (D8); nothing
 * leaves it. This is the only file that touches `UsageStatsManager`.
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
    val events = readEvents(context, start, now).events
    val summary = UsageSessions.summarize(events, days, zone, now, excluded(context))
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

  data class AppUsage(
    val packageName: String,
    /** Sessions that started on the range's days (UsageSessions.sessions). */
    val sessions: Int,
    val medianMillis: Long,
    /** Foreground time per day, same order as `Stats.days`. */
    val millisByDay: List<Long>,
  )

  data class Stats(
    /** The oldest event the phone still keeps; days before it have no data. */
    val firstEventMillis: Long?,
    val days: List<LocalDate>,
    val today: LocalDate,
    val apps: List<AppUsage>,
  )

  /**
   * Every app used from `from` until `toExclusive` (or now), with its sessions,
   * their median and its time per day (docs/real-savings-estimate-plan.md §3.1).
   */
  fun readStats(
    context: Context,
    from: LocalDate,
    toExclusive: LocalDate?,
    zone: ZoneId = ZoneId.systemDefault(),
  ): Stats {
    val today = LocalDate.now(zone)
    val last = minOf(toExclusive?.minusDays(1) ?: today, today)
    val days = generateSequence(from) { it.plusDays(1) }.takeWhile { !it.isAfter(last) }.toList()
    val start = from.atStartOfDay(zone).toInstant().toEpochMilli()
    val end = minOf(
      System.currentTimeMillis(),
      toExclusive?.atStartOfDay(zone)?.toInstant()?.toEpochMilli() ?: Long.MAX_VALUE,
    )
    if (days.isEmpty() || end <= start) return Stats(null, emptyList(), today, emptyList())
    val read = readEvents(context, start, end)
    val excluded = excluded(context)
    val perDay = UsageSessions.summarize(read.events, days, zone, end, excluded)
    val stats = UsageSessions.appStats(
      UsageSessions.sessions(read.events, end, excluded), days, zone,
    )
    val packages = (perDay.flatMap { it.appMillis.keys } + stats.keys).toSortedSet()
    val apps = packages.map { packageName ->
      val app = stats[packageName]
      AppUsage(
        packageName = packageName,
        sessions = app?.sessions ?: 0,
        medianMillis = app?.medianMillis ?: 0L,
        millisByDay = perDay.map { it.appMillis[packageName] ?: 0L },
      )
    }
    return Stats(read.firstEventMillis, days, today, apps)
  }

  private class Read(val events: List<UsageSessions.Event>, val firstEventMillis: Long?)

  private fun readEvents(context: Context, start: Long, end: Long): Read {
    val manager = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
    val raw = manager.queryEvents(start, end)
    val event = UsageEvents.Event()
    val events = mutableListOf<UsageSessions.Event>()
    var first: Long? = null
    while (raw.hasNextEvent()) {
      raw.getNextEvent(event)
      if (first == null || event.timeStamp < first) first = event.timeStamp
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
    return Read(events, first)
  }

  /**
   * Settings is where the onboarding itself sends the user (usage access,
   * Accessibility): its time says nothing about habits and it is never an app
   * to pause. Still's own pause is left out too, so it never splits a visit.
   */
  private fun excluded(context: Context): (String) -> Boolean {
    val launchable = launchablePackages(context)
    val home = homePackages(context)
    return { packageName ->
      packageName == context.packageName ||
        packageName == "com.android.systemui" ||
        packageName == "com.android.settings" ||
        packageName in home ||
        packageName !in launchable
    }
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
