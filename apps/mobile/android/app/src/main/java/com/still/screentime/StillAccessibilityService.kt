package com.still.screentime

import android.accessibilityservice.AccessibilityService
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.os.SystemClock
import android.provider.Settings
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import android.view.accessibility.AccessibilityWindowInfo
import java.time.Instant

class StillAccessibilityService : AccessibilityService() {
  private val preferences by lazy { getSharedPreferences(StillRestrictionModule.PREFERENCES, Context.MODE_PRIVATE) }
  private var lastInterventionPackage: String? = null
  private var lastInterventionAt = 0L
  /**
   * The last counted open: which app, when, and its go backs + entries then.
   * Unlike `lastInterventionPackage`, another app coming to the front (the
   * launcher, mid-transition) does not clear it.
   */
  private var lastCountedPackage: String? = null
  private var lastCountedAt = 0L
  private var outcomesAtLastOpen = -1
  private var lastPipSweepAt = 0L
  private val expiryHandler = Handler(Looper.getMainLooper())
  /**
   * Looks at the front app again once things settle. Events can arrive while
   * the window list still shows the launcher or a shield that is closing, and
   * a warm reopen may send nothing more once the app is in front.
   */
  private val settleCheck = Runnable { guarded("settle check") { enforce(eventPackage = null) } }
  /** The last shield launched, checked once it had time to come up. */
  private var launched: Launch? = null
  /** Launches in a row whose shield never came to the front. */
  private var unshownLaunches = 0
  private val verifyShield = Runnable { guarded("shield check") { verifyLaunch() } }
  /** One pending timer per app with a live access window, keyed by package. */
  private val armedWindows = mutableMapOf<String, Runnable>()
  /**
   * Loads the rewarded ad the moment the screen comes on or the phone is
   * unlocked, usually seconds before an app opens, so the shield can show it
   * the instant the user taps.
   */
  private val screenReceiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
      guarded("screen ${intent.action}") {
        when (intent.action) {
          Intent.ACTION_SCREEN_ON -> StillRewardedAdManager.preload(context, "screen-on")
          Intent.ACTION_USER_PRESENT -> StillRewardedAdManager.preload(context, "unlocked")
        }
      }
    }
  }
  private var screenReceiverRegistered = false
  private val adWarmUp = Runnable {
    guarded("ad warm-up") { StillRewardedAdManager.preload(applicationContext, "service-idle") }
  }

  override fun onServiceConnected() {
    super.onServiceConnected()
    active = this
    // Each step on its own: one that fails is logged and the rest still run,
    // so the service never dies on its way up (docs/android-parity-plan.md §15).
    guarded("sanitize preferences") {
      StillSelfProtection.sanitizePreferences(preferences, packageName)
    }
    // No ad loads here: when Android restarts Still just for this service
    // (after the phone closed it), that start has to be quick. The ad loads
    // when the screen comes on, when a chosen app opens, or a few seconds
    // from now if the screen is already on.
    guarded("ad refill triggers") { startAdRefillTriggers() }
    // Windows granted before this service (re)started are honoured from here:
    // anything already past its deadline is closed on the spot.
    guarded("access windows") { armAccessWindows() }
    // The user just switched Still on from the onboarding: take them back to
    // it, where the step checks the switch itself (docs/onboarding-v2-plan §6.2).
    guarded("return to setup") {
      if (StillSetup.consumeAwaiting(preferences, StillSetup.AWAITING_ACCESSIBILITY)) {
        StillSetup.bringStillToFront(this)
      }
    }
  }

  override fun onUnbind(intent: Intent?): Boolean {
    if (active === this) active = null
    expiryHandler.removeCallbacksAndMessages(null)
    armedWindows.clear()
    stopAdRefillTriggers()
    return super.onUnbind(intent)
  }

  override fun onDestroy() {
    if (active === this) active = null
    expiryHandler.removeCallbacksAndMessages(null)
    armedWindows.clear()
    stopAdRefillTriggers()
    super.onDestroy()
  }

  private fun startAdRefillTriggers() {
    if (!screenReceiverRegistered) {
      val filter = IntentFilter().apply {
        addAction(Intent.ACTION_SCREEN_ON)
        addAction(Intent.ACTION_USER_PRESENT)
      }
      // Only system broadcasts, so no exported flag is needed.
      screenReceiverRegistered = runCatching { registerReceiver(screenReceiver, filter) }
        .onFailure { Log.w(TAG, "screen receiver not registered", it) }
        .isSuccess
    }
    val screenOn = getSystemService(PowerManager::class.java)?.isInteractive == true
    if (screenOn) expiryHandler.postDelayed(adWarmUp, AD_WARM_UP_DELAY_MS)
  }

  private fun stopAdRefillTriggers() {
    if (screenReceiverRegistered) {
      runCatching { unregisterReceiver(screenReceiver) }
      screenReceiverRegistered = false
    }
  }

  override fun onAccessibilityEvent(event: AccessibilityEvent?) {
    val type = event?.eventType ?: return
    if (type != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED &&
      type != AccessibilityEvent.TYPE_WINDOWS_CHANGED
    ) {
      return
    }
    // Close any Picture-in-Picture window a chosen app slipped above the shield.
    guarded("picture-in-picture sweep") { closeLockedAppPictureInPicture() }

    guarded("enforce") {
      if (!preferences.getBoolean(StillRestrictionModule.KEY_RESTRICTIONS_ENABLED, false)) {
        return@guarded
      }
      enforce(event.packageName?.toString())
      scheduleSettleCheck(SETTLE_CHECK_MS)
    }
  }

  /**
   * Runs one step of a system callback. An exception here would kill the
   * process, and on a Xiaomi without Autostart Android would not bring the
   * service back (§15): it is logged instead and the next step still runs.
   */
  private inline fun guarded(step: String, block: () -> Unit) {
    try {
      block()
    } catch (error: Exception) {
      Log.e(TAG, "$step failed", error)
    }
  }

  private fun scheduleSettleCheck(delayMs: Long) {
    expiryHandler.removeCallbacks(settleCheck)
    expiryHandler.postDelayed(settleCheck, delayMs)
  }

  /**
   * Puts the shield over the app in front when it is a chosen app with no
   * access window. Called for every window event and again once they settle.
   */
  private fun enforce(eventPackage: String?) {
    if (!preferences.getBoolean(StillRestrictionModule.KEY_RESTRICTIONS_ENABLED, false)) return

    // Resolve the foreground app from the window list rather than the event's
    // package: a warm re-open only resumes the activity and may not carry the
    // package on the event, which used to let the app slip through on reopen.
    val target = currentForegroundApp() ?: eventPackage ?: return

    if (StillSelfProtection.isOwnPackage(packageName, target)) {
      // The shield itself is in front; nothing to do.
      return
    }
    val selected = preferences.getStringSet(StillRestrictionModule.KEY_SELECTED_PACKAGES, emptySet()) ?: emptySet()
    if (target !in selected) {
      // A non-chosen app is in front: forget the last target so the next open
      // of a chosen app always re-shields.
      if (preferences.getString(StillRestrictionModule.KEY_CURRENT_PACKAGE, null) != null &&
        currentForegroundApp() != null
      ) {
        preferences.edit().remove(StillRestrictionModule.KEY_CURRENT_PACKAGE).apply()
      }
      lastInterventionPackage = null
      unshownLaunches = 0
      return
    }
    if (isTemporarilyUnlocked(target)) {
      // Self-heals a window whose timer was lost with the previous process.
      if (!armedWindows.containsKey(target)) armAccessWindows()
      return
    }
    if (isExternalAuthBrowser(target)) return

    val now = SystemClock.elapsedRealtime()
    val sinceLaunch = now - lastInterventionAt
    if (lastInterventionPackage == target && sinceLaunch < LAUNCH_SETTLE_MS) {
      // Its shield was launched a moment ago. If the app is still the one in
      // front when that moment is over, look again rather than trust it came
      // up: the app's own late window, or a quick close and reopen, can land
      // here and then send no further event.
      scheduleSettleCheck(LAUNCH_SETTLE_MS - sinceLaunch + SETTLE_CHECK_MS)
      return
    }
    if (lastCountedPackage == target &&
      now - lastCountedAt < SHIELD_START_GRACE_MS &&
      outcomes(target) == outcomesAtLastOpen
    ) {
      // Nothing was chosen on the shield since this app was counted: on a cold
      // start the shield takes seconds and the app's own late window can cover
      // it. Bring the shield up again; it is the same open, not a new one
      // (docs/real-savings-estimate-plan.md §12).
      val attempts = preferences.getInt(
        StillRestrictionModule.appMetricKey(
          StillRestrictionModule.METRIC_APP_OPEN_ATTEMPTS,
          StillDay.today(),
          target,
        ),
        1,
      ).coerceAtLeast(1)
      lastInterventionPackage = target
      lastInterventionAt = now
      launchShield(target, attempts)
      return
    }
    lastInterventionPackage = target
    lastInterventionAt = now

    // A setup test: the same shield, in test mode, counting nothing
    // (docs/onboarding-v2-plan.md §6.4).
    if (StillSetup.probePackage(preferences) == target) {
      launchShield(target, attempts = 1, setupProbe = true)
      return
    }

    val day = StillDay.today()
    val attemptsKey = "open_attempts:$day"
    val appAttemptsKey = StillRestrictionModule.appMetricKey(
      StillRestrictionModule.METRIC_APP_OPEN_ATTEMPTS,
      day,
      target,
    )
    val nextAttempts = preferences.getInt(appAttemptsKey, 0) + 1
    val editor = preferences.edit()
      .putString(StillRestrictionModule.KEY_CURRENT_PACKAGE, target)
      .putInt(attemptsKey, preferences.getInt(attemptsKey, 0) + 1)
      .putInt(appAttemptsKey, nextAttempts)
      .putString(
        StillRestrictionModule.appStateKey(StillRestrictionModule.STATE_LAST_PAUSE_AT, target),
        Instant.now().toString(),
      )
    StillRestrictionModule.recordPauseTrail(editor, preferences, target, System.currentTimeMillis())
    editor.apply()
    rememberCountedOpen(target, now)

    // Refresh the ad if it expired since the last intervention. If it is not
    // ready in time the shield waits for it, then falls back to the timed pause.
    StillRewardedAdManager.preload(applicationContext, "intervention")

    launchShield(target, nextAttempts)
  }

  private fun rememberCountedOpen(target: String, at: Long) {
    lastCountedPackage = target
    lastCountedAt = at
    outcomesAtLastOpen = outcomes(target)
  }

  /** Times the user went back from or into `target`'s shield today. */
  private fun outcomes(target: String): Int {
    val day = StillDay.today()
    fun metric(name: String) =
      preferences.getInt(StillRestrictionModule.appMetricKey(name, day, target), 0)
    return metric(StillRestrictionModule.METRIC_APP_AVOIDED_OPENS) +
      metric(StillRestrictionModule.METRIC_APP_UNLOCKS)
  }

  private fun launchShield(target: String, attempts: Int, setupProbe: Boolean = false) {
    if (launched?.target != target) unshownLaunches = 0
    launched = Launch(target, attempts, setupProbe, SystemClock.elapsedRealtime())
    runCatching {
      startActivity(Intent(this, InterventionActivity::class.java).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS)
        putExtra(InterventionActivity.EXTRA_TARGET_PACKAGE, target)
        putExtra(InterventionActivity.EXTRA_TARGET_ATTEMPTS, attempts)
        putExtra(InterventionActivity.EXTRA_SETUP_PROBE, setupProbe)
      })
    }
    expiryHandler.removeCallbacks(verifyShield)
    expiryHandler.postDelayed(verifyShield, SHIELD_VERIFY_MS)
  }

  /**
   * The shield just launched must be in front by now. If its app is still
   * the one in front, the shield either came up and the user got back to the
   * app without choosing (closed it and reopened the app quickly), or it
   * never came up, because some makers refuse a start from the background.
   * Either way it is launched again; a second start that never showed goes
   * through the Home Screen, which `GLOBAL_ACTION_HOME` always reaches.
   */
  private fun verifyLaunch() {
    val launch = launched ?: return
    if (!preferences.getBoolean(StillRestrictionModule.KEY_RESTRICTIONS_ENABLED, false)) return
    if (currentForegroundApp() != launch.target || isTemporarilyUnlocked(launch.target)) return
    if (InterventionActivity.shownFor == launch.target) return

    val came = InterventionActivity.lastShownAt >= launch.at
    unshownLaunches = if (came) 0 else unshownLaunches + 1
    lastInterventionPackage = launch.target
    lastInterventionAt = SystemClock.elapsedRealtime()
    if (unshownLaunches >= 2) {
      unshownLaunches = 0
      runCatching { performGlobalAction(GLOBAL_ACTION_HOME) }
      expiryHandler.postDelayed(
        { guarded("shield relaunch") { launchShield(launch.target, launch.attempts, launch.setupProbe) } },
        SHIELD_AFTER_HOME_MS,
      )
      return
    }
    launchShield(launch.target, launch.attempts, launch.setupProbe)
  }

  /**
   * The package of the app currently in front, from the window list. Ignores the
   * shield itself and floating Picture-in-Picture windows, so it reports the real
   * foreground app even when it was only resumed (warm re-open).
   */
  private fun currentForegroundApp(): String? {
    val wins = runCatching { windows }.getOrNull() ?: return null
    val appWindows = wins.filter {
      it.type == AccessibilityWindowInfo.TYPE_APPLICATION &&
        !runCatching { it.isInPictureInPictureMode }.getOrDefault(false)
    }
    val focused = appWindows.firstOrNull { it.isFocused }
    val candidate = focused ?: appWindows.maxByOrNull { it.layer } ?: return null
    val root = runCatching { candidate.root }.getOrNull() ?: return null
    return root.packageName?.toString()
  }

  /**
   * Finds any Picture-in-Picture window that belongs to a chosen, not-unlocked
   * app and closes it, so a floating video cannot sit above the shield. Window
   * content is used only to locate and dismiss the PiP, never read or stored.
   */
  private fun closeLockedAppPictureInPicture() {
    if (!preferences.getBoolean(StillRestrictionModule.KEY_RESTRICTIONS_ENABLED, false)) return
    val now = SystemClock.elapsedRealtime()
    if (now - lastPipSweepAt < 300) return
    lastPipSweepAt = now
    val selected = preferences.getStringSet(StillRestrictionModule.KEY_SELECTED_PACKAGES, emptySet()) ?: return
    if (selected.isEmpty()) return

    val currentWindows = runCatching { windows }.getOrNull() ?: return
    for (window in currentWindows) {
      if (!runCatching { window.isInPictureInPictureMode }.getOrDefault(false)) continue
      val root = runCatching { window.root }.getOrNull() ?: continue
      val pkg = root.packageName?.toString()
      if (pkg == null ||
        pkg !in selected ||
        StillSelfProtection.isOwnPackage(packageName, pkg) ||
        isTemporarilyUnlocked(pkg)
      ) {
        continue
      }
      val dismissed = runCatching {
        root.performAction(AccessibilityNodeInfo.ACTION_DISMISS)
      }.getOrDefault(false)
      if (!dismissed) clickCloseControl(root)
    }
  }

  /** Depth-first search for a clickable "close" control inside a PiP window. */
  private fun clickCloseControl(root: AccessibilityNodeInfo): Boolean {
    val stack = ArrayDeque<AccessibilityNodeInfo>()
    stack.addLast(root)
    var visited = 0
    while (stack.isNotEmpty() && visited < 200) {
      val node = stack.removeLast()
      visited += 1
      val label = ((node.contentDescription ?: node.text)?.toString() ?: "").lowercase()
      if (node.isClickable && CLOSE_LABELS.any { label.contains(it) }) {
        if (runCatching { node.performAction(AccessibilityNodeInfo.ACTION_CLICK) }.getOrDefault(false)) {
          return true
        }
      }
      for (index in 0 until node.childCount) {
        node.getChild(index)?.let(stack::addLast)
      }
    }
    return false
  }

  /**
   * Schedules the exact end of every live access window, so the pause comes
   * back on time whether or not the user ever leaves the app. Deadlines are
   * stored on `elapsedRealtime`, which no clock change can move, and the boot
   * count they were taken with is checked before they are trusted.
   */
  private fun armAccessWindows() {
    val boot = currentBootCount()
    val now = SystemClock.elapsedRealtime()
    val windows = preferences.all
      .filterKeys { it.startsWith(StillRestrictionModule.UNLOCKED_PREFIX) }
      .mapNotNull { (key, value) ->
        val target = key.removePrefix(StillRestrictionModule.UNLOCKED_PREFIX)
        val deadline = value as? Long
        if (target.isEmpty() || deadline == null) null else target to deadline
      }
      .toMap()

    for (target in armedWindows.keys.toList()) {
      if (target !in windows) armedWindows.remove(target)?.let(expiryHandler::removeCallbacks)
    }

    for ((target, deadline) in windows) {
      armedWindows.remove(target)?.let(expiryHandler::removeCallbacks)
      val sameBoot = preferences.getInt(
        "${StillRestrictionModule.UNLOCKED_BOOT_PREFIX}$target",
        -1,
      ) == boot
      if (!sameBoot || deadline <= now) {
        expireAccessWindow(target)
        continue
      }
      val task = Runnable { guarded("access window end") { expireAccessWindow(target) } }
      armedWindows[target] = task
      expiryHandler.postDelayed(task, deadline - now)
    }
  }

  /**
   * The window is over. The grant is cleared first so nothing can slip through,
   * and if the app is still in front the shield is brought back immediately —
   * the pause does not wait for the user to close and reopen the app.
   */
  private fun expireAccessWindow(target: String) {
    armedWindows.remove(target)?.let(expiryHandler::removeCallbacks)
    preferences.edit()
      .remove("${StillRestrictionModule.UNLOCKED_PREFIX}$target")
      .remove("${StillRestrictionModule.UNLOCKED_BOOT_PREFIX}$target")
      .apply()
    if (!preferences.getBoolean(StillRestrictionModule.KEY_RESTRICTIONS_ENABLED, false)) return
    val selected = preferences.getStringSet(
      StillRestrictionModule.KEY_SELECTED_PACKAGES,
      emptySet(),
    ) ?: emptySet()
    if (target !in selected || StillSelfProtection.isOwnPackage(packageName, target)) return
    reshieldIfInFront(target)
  }

  /**
   * Puts the shield back over [target] while it is still the app in front.
   *
   * Starting an activity from a service is refused by some OEMs, so one check
   * follows. It waits long enough for the window transition to finish —
   * checking too early reads the target as still focused and would send the
   * shield it just opened to the background. If the target really is still
   * there, `GLOBAL_ACTION_HOME` (an accessibility action, never refused) takes
   * it off screen and the shield is opened again from the Home Screen.
   */
  private fun reshieldIfInFront(target: String) {
    if (currentForegroundApp() != target) return
    if (isTemporarilyUnlocked(target)) return

    // The window ending is not a new open attempt, so today's counter is read
    // rather than raised; the pause timestamp is what actually changed.
    val day = StillDay.today()
    val attempts = preferences.getInt(
      StillRestrictionModule.appMetricKey(
        StillRestrictionModule.METRIC_APP_OPEN_ATTEMPTS,
        day,
        target,
      ),
      1,
    ).coerceAtLeast(1)
    preferences.edit()
      .putString(StillRestrictionModule.KEY_CURRENT_PACKAGE, target)
      .putString(
        StillRestrictionModule.appStateKey(StillRestrictionModule.STATE_LAST_PAUSE_AT, target),
        Instant.now().toString(),
      )
      .apply()
    // Keep the window-change path from launching a second shield right after.
    lastInterventionPackage = target
    lastInterventionAt = SystemClock.elapsedRealtime()
    rememberCountedOpen(target, lastInterventionAt)
    StillRewardedAdManager.preload(applicationContext, "window-ended")
    launchShield(target, attempts)

    expiryHandler.postDelayed({
      guarded("reshield check") {
        // Anything other than the target in front means the shield came up.
        if (currentForegroundApp() != target || isTemporarilyUnlocked(target)) return@guarded
        runCatching { performGlobalAction(GLOBAL_ACTION_HOME) }
        expiryHandler.postDelayed(
          { guarded("shield relaunch") { launchShield(target, attempts) } },
          SHIELD_AFTER_HOME_MS,
        )
      }
    }, RESHIELD_VERIFY_MS)
  }

  private fun currentBootCount() =
    Settings.Global.getInt(contentResolver, Settings.Global.BOOT_COUNT, 0)

  private fun isTemporarilyUnlocked(packageName: String): Boolean {
    val expectedBoot = preferences.getInt(
      "${StillRestrictionModule.UNLOCKED_BOOT_PREFIX}$packageName",
      -1,
    )
    val deadline = preferences.getLong(
      "${StillRestrictionModule.UNLOCKED_PREFIX}$packageName",
      0,
    )
    if (expectedBoot == currentBootCount() && SystemClock.elapsedRealtime() < deadline) return true
    preferences.edit()
      .remove("${StillRestrictionModule.UNLOCKED_PREFIX}$packageName")
      .remove("${StillRestrictionModule.UNLOCKED_BOOT_PREFIX}$packageName")
      .apply()
    return false
  }

  private fun isExternalAuthBrowser(packageName: String): Boolean {
    val expectedBoot = preferences.getInt(StillRestrictionModule.KEY_EXTERNAL_AUTH_BYPASS_BOOT, -1)
    val boot = Settings.Global.getInt(contentResolver, Settings.Global.BOOT_COUNT, 0)
    val deadline = preferences.getLong(StillRestrictionModule.KEY_EXTERNAL_AUTH_BYPASS_UNTIL, 0)
    val active = expectedBoot == boot && SystemClock.elapsedRealtime() < deadline
    if (!active) {
      preferences.edit()
        .remove(StillRestrictionModule.KEY_EXTERNAL_AUTH_BYPASS_PACKAGES)
        .remove(StillRestrictionModule.KEY_EXTERNAL_AUTH_BYPASS_UNTIL)
        .remove(StillRestrictionModule.KEY_EXTERNAL_AUTH_BYPASS_BOOT)
        .apply()
      return false
    }
    val browsers = preferences.getStringSet(
      StillRestrictionModule.KEY_EXTERNAL_AUTH_BYPASS_PACKAGES,
      emptySet(),
    ) ?: emptySet()
    return packageName in browsers
  }

  override fun onInterrupt() = Unit

  /** A shield start: for which app, with what it showed, and when. */
  private data class Launch(
    val target: String,
    val attempts: Int,
    val setupProbe: Boolean,
    val at: Long,
  )

  companion object {
    private const val TAG = "StillAccessibility"
    /** The ad loads this long after the service starts with the screen on. */
    private const val AD_WARM_UP_DELAY_MS = 5_000L
    private val CLOSE_LABELS = listOf("close", "cerrar", "descartar", "dismiss")
    /** A shield launched this recently for the same app is not launched again. */
    private const val LAUNCH_SETTLE_MS = 1_200L
    /** How long after the last window event the front app is looked at again. */
    private const val SETTLE_CHECK_MS = 450L
    /** How long a shield gets to reach the front before it is checked. */
    private const val SHIELD_VERIFY_MS = 1_800L
    /**
     * While its shield is unanswered, the same app within this time is the same
     * open. A cold start of Still's process kept the shield from settling for
     * up to 13 s on the QA emulator.
     */
    private const val SHIELD_START_GRACE_MS = 15_000L
    /**
     * How long to wait before checking that the shield actually came up. Long
     * enough for the window transition to settle: the grant is already gone,
     * so these are seconds of a window that has ended, not of one still valid.
     */
    private const val RESHIELD_VERIFY_MS = 1_500L
    /** Time for the Home Screen to settle before the shield is opened over it. */
    private const val SHIELD_AFTER_HOME_MS = 350L

    /**
     * The connected service, or null while it is not running. Only the running
     * service can watch a deadline; a grant written while it is down is picked
     * up by `onServiceConnected`, which closes anything already expired.
     */
    @Volatile
    private var active: StillAccessibilityService? = null

    /**
     * The service is bound and running, not just listed as enabled: some makers
     * keep it switched on in Settings after killing it (§4.3, 11A).
     */
    val isRunning: Boolean get() = active != null

    /**
     * Opens Recents, where the user locks Still's card so the maker never
     * closes it (docs/android-parity-plan.md §13). Only the running service
     * can; false otherwise.
     */
    fun openRecents(): Boolean = active?.performGlobalAction(GLOBAL_ACTION_RECENTS) == true

    /** Called whenever an access window is granted, from any path. */
    fun watchAccessWindows() {
      val service = active ?: return
      service.expiryHandler.post { service.armAccessWindows() }
    }
  }
}
