package com.still.screentime

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.provider.Settings
import android.view.Gravity
import android.view.HapticFeedbackConstants
import android.view.View
import android.view.ViewGroup
import android.widget.LinearLayout
import android.widget.TextView
import java.text.NumberFormat
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset
import java.util.UUID
import org.json.JSONArray
import org.json.JSONObject

/**
 * The shield: one screen from "app opened" to the decision. Ad, fallbacks and
 * decision all happen here, never by jumping to another Still screen. The order
 * and the fallbacks mirror the pure state machine in
 * `src/lib/intervention-flow.ts` (ad → decision; and with no ad: saved pass →
 * emergency → 15-second pause), which is the tested source of truth (D6).
 */
class InterventionActivity : Activity() {
  private val graphite = Color.rgb(36, 40, 38)
  private val chalk = Color.rgb(241, 239, 232)
  private val mineral = Color.rgb(105, 127, 140)
  private val mineralLight = Color.rgb(167, 181, 186)
  private val peach = Color.rgb(211, 154, 131)

  private enum class Gate { WATCH_AD, USE_REWARDED_PASS, USE_EMERGENCY, TIMED_PAUSE }
  private enum class EnterSource { FRESH_AD, SAVED_PASS, EMERGENCY, PAUSE }

  private var spanish = false
  private var appLabel = ""
  private var attempts = 1
  private var durationSeconds = 600
  private var durationLabel = "10 min"
  private var busy = false
  private var pauseSecondsLeft = PAUSE_SECONDS
  private val pauseHandler = Handler(Looper.getMainLooper())
  private var pauseTick: Runnable? = null

  private val currentTargetPackage: String?
    get() = intent?.getStringExtra(EXTRA_TARGET_PACKAGE)

  private val preferences by lazy {
    getSharedPreferences(StillRestrictionModule.PREFERENCES, MODE_PRIVATE)
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    window.statusBarColor = graphite
    window.navigationBarColor = graphite
    window.decorView.systemUiVisibility = 0

    spanish = resources.configuration.locales[0].language == "es"
    val targetPackage = currentTargetPackage
    if (StillSelfProtection.isOwnPackage(packageName, targetPackage)) {
      StillSelfProtection.clearOwnTarget(preferences, packageName)
      finish()
      return
    }
    if (!preferences.getBoolean(StillRestrictionModule.KEY_RESTRICTIONS_ENABLED, false)) {
      goHome(recordAvoidedOpen = false)
      return
    }

    appLabel = targetPackage?.let {
      runCatching {
        packageManager.getApplicationLabel(packageManager.getApplicationInfo(it, 0)).toString()
      }.getOrNull()
    } ?: if (spanish) "App seleccionada" else "Selected app"

    val day = LocalDate.now(ZoneOffset.UTC).toString()
    attempts = intent.getIntExtra(EXTRA_TARGET_ATTEMPTS, 0).takeIf { it > 0 }
      ?: targetPackage?.let {
        preferences.getInt(
          StillRestrictionModule.appMetricKey(
            StillRestrictionModule.METRIC_APP_OPEN_ATTEMPTS,
            day,
            it,
          ),
          1,
        )
      }?.coerceAtLeast(1) ?: 1
    durationSeconds = preferences
      .getInt(StillRestrictionModule.KEY_UNLOCK_DURATION_SECONDS, 600)
      .coerceIn(60, 86400)
    durationLabel = formatDuration(durationSeconds)

    renderByGate()
  }

  /** Mirrors gateFromUnlockAction: ad, else saved pass, else emergency, else pause. */
  private fun currentGate(): Gate {
    if (StillRewardedAdManager.isAdReady()) return Gate.WATCH_AD
    if (preferences.getInt(StillRestrictionModule.KEY_REWARDED_BALANCE, 0) > 0) {
      return Gate.USE_REWARDED_PASS
    }
    if (preferences.getInt(StillRestrictionModule.KEY_EMERGENCY_REMAINING, 0) > 0) {
      return Gate.USE_EMERGENCY
    }
    return Gate.TIMED_PAUSE
  }

  private fun renderByGate() {
    when (currentGate()) {
      Gate.TIMED_PAUSE -> renderPause()
      else -> renderShield()
    }
  }

  /**
   * The gate the user meets first. `acceptance:shield` asserts this heading and
   * the Go back / Volver control, so their text stays stable.
   */
  private fun renderShield() {
    busy = false
    val gate = currentGate()
    val attemptLabel = when {
      spanish && attempts == 1 -> "una vez"
      spanish -> "$attempts veces"
      attempts == 1 -> "once"
      else -> "$attempts times"
    }
    val observedFact = if (spanish) {
      "$appLabel se abrió $attemptLabel hoy."
    } else {
      "$appLabel opened $attemptLabel today."
    }
    val question = if (durationSeconds >= 86400) {
      if (spanish) "¿Qué quieres del resto del día?" else "What do you want from the rest of the day?"
    } else {
      if (spanish) "¿Qué quieres de los próximos $durationLabel?" else "What do you want from the next $durationLabel?"
    }

    val secondaryLabel = when (gate) {
      Gate.WATCH_AD -> if (spanish) "Ver anuncio" else "Watch ad"
      Gate.USE_REWARDED_PASS ->
        if (spanish) "Usar 1 pase · $durationLabel" else "Use 1 pass · $durationLabel"
      Gate.USE_EMERGENCY ->
        if (spanish) "Acceso de emergencia · $durationLabel" else "Emergency access · $durationLabel"
      Gate.TIMED_PAUSE -> if (spanish) "Ver anuncio" else "Watch ad"
    }

    val root = column()
    root.addView(spacer(1.2f))
    root.addView(createFieldIcon(), LinearLayout.LayoutParams(dp(64), dp(64)))
    root.addView(headline(observedFact))
    root.addView(subtext(question + "\n\n" + impactSummary(currentTargetPackage)))
    root.addView(spacer(1f))
    root.addView(filledButton(if (spanish) "Volver" else "Go back") { goHome() })
    root.addView(
      textButton(secondaryLabel, chalk, enabled = true) {
        when (gate) {
          Gate.WATCH_AD -> startAd()
          Gate.USE_REWARDED_PASS -> enterTarget(EnterSource.SAVED_PASS)
          Gate.USE_EMERGENCY -> enterTarget(EnterSource.EMERGENCY)
          Gate.TIMED_PAUSE -> renderPause()
        }
      },
    )
    setContentView(root)
  }

  /** Shows the preloaded ad in this same window, then the decision (D2). */
  private fun startAd() {
    if (busy) return
    busy = true
    val shown = StillRewardedAdManager.show(this) { outcome ->
      busy = false
      if (outcome.earned) {
        renderDecision(EnterSource.FRESH_AD)
      } else {
        // Closed early or could not show: no penalty, fall back to the gate.
        renderByGate()
      }
    }
    if (!shown) {
      busy = false
      renderByGate()
    }
  }

  /**
   * 15-second breathing pause when there is no ad, pass or emergency (D3). Costs
   * nothing and is not reported; entering afterwards grants a short window only.
   */
  private fun renderPause() {
    pauseSecondsLeft = PAUSE_SECONDS
    val root = column()
    root.addView(spacer(1.2f))
    root.addView(createFieldIcon(), LinearLayout.LayoutParams(dp(64), dp(64)))
    val counter = headline(if (spanish) "Respira.\n$pauseSecondsLeft" else "Breathe.\n$pauseSecondsLeft")
    root.addView(counter)
    root.addView(
      subtext(
        if (spanish) "Ahora mismo no hay ningún anuncio disponible. Podrás decidir cuando termine la pausa."
        else "No ad is available right now. You can decide when the pause ends.",
      ),
    )
    root.addView(spacer(1f))
    val leave = filledButton(if (spanish) "Ya no quiero entrar" else "I don't want to go in anymore") {
      stopPause()
      goHome()
    }
    root.addView(leave)
    val enter = textButton(
      if (spanish) "Quiero entrar · ${pauseSecondsLeft}s" else "I want to go in · ${pauseSecondsLeft}s",
      mineralLight,
      enabled = false,
    ) {}
    root.addView(enter)
    setContentView(root)

    stopPause()
    pauseTick = object : Runnable {
      override fun run() {
        pauseSecondsLeft -= 1
        if (pauseSecondsLeft <= 0) {
          counter.text = if (spanish) "Respira.\n0" else "Breathe.\n0"
          renderDecision(EnterSource.PAUSE)
          return
        }
        counter.text = if (spanish) "Respira.\n$pauseSecondsLeft" else "Breathe.\n$pauseSecondsLeft"
        enter.text =
          if (spanish) "Quiero entrar · ${pauseSecondsLeft}s" else "I want to go in · ${pauseSecondsLeft}s"
        pauseHandler.postDelayed(this, 1_000)
      }
    }
    pauseHandler.postDelayed(pauseTick!!, 1_000)
  }

  private fun stopPause() {
    pauseTick?.let(pauseHandler::removeCallbacks)
    pauseTick = null
  }

  /** After the ad or pause completes: enter the app, or leave. Order is friction → decision. */
  private fun renderDecision(source: EnterSource) {
    val windowSeconds = if (source == EnterSource.PAUSE) PAUSE_ALLOWANCE_SECONDS else durationSeconds
    val windowLabel = formatDuration(windowSeconds)
    val keepsPass = source == EnterSource.FRESH_AD
    val root = column()
    root.addView(spacer(1.2f))
    root.addView(createFieldIcon(), LinearLayout.LayoutParams(dp(64), dp(64)))
    root.addView(
      headline(
        if (spanish) "¿Sigues queriendo abrir $appLabel?"
        else "Do you still want to open $appLabel?",
      ),
    )
    root.addView(
      subtext(
        if (keepsPass) {
          if (spanish) "Si entras, $appLabel queda abierta durante $windowLabel. Si te vas ahora, el pase que ganaste se guarda para después."
          else "Going in keeps $appLabel open for $windowLabel. If you leave now, the pass you earned is saved for later."
        } else {
          if (spanish) "Si entras, $appLabel queda abierta durante $windowLabel."
          else "Going in keeps $appLabel open for $windowLabel."
        },
      ),
    )
    root.addView(spacer(1f))
    root.addView(
      filledButton(if (spanish) "Quiero entrar" else "I want to go in") { enterTarget(source) },
    )
    root.addView(
      textButton(
        if (spanish) "Ya no quiero entrar" else "I don't want to go in anymore",
        chalk,
        enabled = true,
      ) { goHome() },
    )
    setContentView(root)
  }

  /**
   * Grant the access window for the exact package, record the spend, and relaunch
   * the app. A fresh ad reward and a saved pass both report a rewarded unlock; a
   * pause grants a short window, spends nothing and is not reported (D3).
   */
  private fun enterTarget(source: EnterSource) {
    if (busy) return
    val target = currentTargetPackage ?: return goHome(recordAvoidedOpen = false)
    val launch = packageManager.getLaunchIntentForPackage(target)
    if (launch == null) {
      goHome(recordAvoidedOpen = false)
      return
    }
    busy = true
    val windowSeconds = if (source == EnterSource.PAUSE) PAUSE_ALLOWANCE_SECONDS else durationSeconds
    val boot = Settings.Global.getInt(contentResolver, Settings.Global.BOOT_COUNT, 0)
    val day = LocalDate.now(ZoneOffset.UTC).toString()
    val unlocksKey = "unlocks:$day"
    val appUnlocksKey = StillRestrictionModule.appMetricKey(
      StillRestrictionModule.METRIC_APP_UNLOCKS,
      day,
      target,
    )
    val editor = preferences.edit()
      .putLong("unlocked:$target", SystemClock.elapsedRealtime() + windowSeconds * 1_000L)
      .putInt("unlocked_boot:$target", boot)
      .remove(StillRestrictionModule.KEY_CURRENT_PACKAGE)
      .putInt(unlocksKey, preferences.getInt(unlocksKey, 0) + 1)
      .putInt(appUnlocksKey, preferences.getInt(appUnlocksKey, 0) + 1)
    // Project the local wallet so a rapid second intervention does not offer a
    // pass that was just spent. A fresh ad reward is claimed then spent server
    // side (net zero), so it does not decrement the local projection.
    when (source) {
      EnterSource.SAVED_PASS ->
        editor.putInt(
          StillRestrictionModule.KEY_REWARDED_BALANCE,
          (preferences.getInt(StillRestrictionModule.KEY_REWARDED_BALANCE, 0) - 1).coerceAtLeast(0),
        )
      EnterSource.EMERGENCY ->
        editor.putInt(
          StillRestrictionModule.KEY_EMERGENCY_REMAINING,
          (preferences.getInt(StillRestrictionModule.KEY_EMERGENCY_REMAINING, 0) - 1).coerceAtLeast(0),
        )
      else -> Unit
    }
    editor.apply()

    // A pause is never reported (D3); ad rewards and saved passes are.
    if (source != EnterSource.PAUSE) {
      enqueueUnlockReport(if (source == EnterSource.EMERGENCY) "emergency" else "rewarded")
    }

    launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED)
    runCatching { startActivity(launch) }
    finish()
  }

  private fun enqueueUnlockReport(source: String) {
    val raw = preferences.getString(StillRestrictionModule.KEY_UNLOCK_OUTBOX, null)
    val array = runCatching { if (raw != null) JSONArray(raw) else JSONArray() }.getOrDefault(JSONArray())
    array.put(
      JSONObject()
        .put("clientSessionId", UUID.randomUUID().toString())
        .put("source", source)
        .put("durationSeconds", durationSeconds)
        .put("startedAt", Instant.now().toString()),
    )
    preferences.edit().putString(StillRestrictionModule.KEY_UNLOCK_OUTBOX, array.toString()).apply()
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    // This activity is singleTop. Recreate it so a new blocked app never
    // inherits the previous app's label, count, or actions.
    stopPause()
    recreate()
  }

  override fun onDestroy() {
    stopPause()
    super.onDestroy()
  }

  override fun onBackPressed() = goHome()

  private fun goHome(recordAvoidedOpen: Boolean = true) {
    stopPause()
    if (recordAvoidedOpen) {
      val day = LocalDate.now(ZoneOffset.UTC).toString()
      val totalKey = "avoided_opens:$day"
      val editor = preferences.edit()
        .remove(StillRestrictionModule.KEY_CURRENT_PACKAGE)
        .putInt(totalKey, preferences.getInt(totalKey, 0) + 1)
      currentTargetPackage?.let { packageName ->
        val appKey = StillRestrictionModule.appMetricKey(
          StillRestrictionModule.METRIC_APP_AVOIDED_OPENS,
          day,
          packageName,
        )
        editor.putInt(appKey, preferences.getInt(appKey, 0) + 1)
      }
      editor.apply()
    }
    startActivity(
      Intent(Intent.ACTION_MAIN)
        .addCategory(Intent.CATEGORY_HOME)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
    )
    finish()
  }

  // --- View helpers -------------------------------------------------------

  private fun formatDuration(seconds: Int): String = when {
    seconds >= 86400 -> if (spanish) "todo el día" else "all day"
    seconds >= 3600 -> if (spanish) "1 hora" else "1 hour"
    else -> (seconds / 60.0).toInt().coerceAtLeast(1).toString() + " min"
  }

  private fun column() = LinearLayout(this).apply {
    orientation = LinearLayout.VERTICAL
    gravity = Gravity.CENTER_HORIZONTAL
    setPadding(dp(28), dp(44), dp(28), dp(28))
    setBackgroundColor(graphite)
  }

  private fun spacer(weight: Float) = View(this).also {
    it.layoutParams = LinearLayout.LayoutParams(1, 0, weight)
  }

  private fun headline(value: String) = TextView(this).apply {
    text = value
    gravity = Gravity.CENTER
    textSize = 22f
    typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD)
    setLineSpacing(0f, 1.08f)
    setTextColor(chalk)
    contentDescription = value
    layoutParams = LinearLayout.LayoutParams(
      ViewGroup.LayoutParams.MATCH_PARENT,
      ViewGroup.LayoutParams.WRAP_CONTENT,
    ).apply { topMargin = dp(24) }
  }

  private fun subtext(value: String) = TextView(this).apply {
    text = value
    gravity = Gravity.CENTER
    textSize = 15f
    typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.NORMAL)
    setLineSpacing(dp(3).toFloat(), 1f)
    setTextColor(mineralLight)
    contentDescription = value
    layoutParams = LinearLayout.LayoutParams(
      ViewGroup.LayoutParams.MATCH_PARENT,
      ViewGroup.LayoutParams.WRAP_CONTENT,
    ).apply { topMargin = dp(16) }
  }

  private fun filledButton(label: String, onClick: () -> Unit) = TextView(this).apply {
    text = label
    gravity = Gravity.CENTER
    textSize = 16f
    typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD)
    setTextColor(graphite)
    background = GradientDrawable().apply {
      setColor(chalk)
      cornerRadius = dp(6).toFloat()
    }
    isClickable = true
    isFocusable = true
    contentDescription = label
    setOnClickListener { onClick() }
    layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(54))
  }

  private fun textButton(
    label: String,
    color: Int,
    enabled: Boolean,
    onClick: () -> Unit,
  ) = TextView(this).apply {
    text = label
    gravity = Gravity.CENTER
    textSize = 15f
    typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD)
    setTextColor(color)
    isClickable = enabled
    isFocusable = enabled
    alpha = if (enabled) 1f else 0.42f
    contentDescription = label
    setOnClickListener { if (enabled) onClick() }
    layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(52)).apply {
      topMargin = dp(6)
    }
  }

  private fun createFieldIcon(): View {
    val field = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
      contentDescription = "Still"
    }
    repeat(3) { row ->
      val line = LinearLayout(this).apply {
        orientation = LinearLayout.HORIZONTAL
        gravity = Gravity.CENTER
      }
      val choice = row == 1
      val left = module(if (choice) mineral else chalk)
      val right = module(if (choice) peach else chalk)
      line.addView(left, LinearLayout.LayoutParams(dp(24), dp(10)))
      line.addView(View(this), LinearLayout.LayoutParams(if (choice) dp(12) else dp(6), dp(1)))
      line.addView(right, LinearLayout.LayoutParams(dp(24), dp(10)))
      field.addView(line, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(19)))
      if (choice) {
        left.translationX = dp(3).toFloat()
        right.translationX = -dp(3).toFloat()
        left.animate().translationX(0f).setDuration(520).start()
        right.animate()
          .translationX(0f)
          .setDuration(520)
          .withEndAction { field.performHapticFeedback(HapticFeedbackConstants.CLOCK_TICK) }
          .start()
      }
    }
    return field
  }

  private fun module(color: Int) = View(this).apply {
    background = GradientDrawable().apply {
      setColor(color)
      cornerRadius = dp(2).toFloat()
    }
  }

  private fun impactSummary(targetPackage: String?): String {
    val day = LocalDate.now(ZoneOffset.UTC).toString()
    val avoidedOpens = targetPackage?.let {
      preferences.getInt(
        StillRestrictionModule.appMetricKey(
          StillRestrictionModule.METRIC_APP_AVOIDED_OPENS,
          day,
          it,
        ),
        0,
      )
    }?.coerceAtLeast(0) ?: 0
    val minutesPerOpen =
      preferences.getFloat(StillRestrictionModule.KEY_ESTIMATED_MINUTES_PER_AVOIDED_OPEN, 0f)
    val duration = formatSavedTime(avoidedOpens * minutesPerOpen)
    return if (spanish) {
      "$avoidedOpens aperturas automáticas de $appLabel evitadas hoy · $duration recuperados (est.)"
    } else {
      "$avoidedOpens automatic $appLabel opens avoided today · $duration returned (est.)"
    }
  }

  private fun formatSavedTime(minutes: Float): String {
    val value = if (minutes < 60) minutes else minutes / 60
    val formatted = NumberFormat.getNumberInstance().apply {
      maximumFractionDigits = 1
    }.format(value)
    return if (minutes < 60) "$formatted min" else "$formatted h"
  }

  private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()

  companion object {
    const val EXTRA_TARGET_PACKAGE = "target_package"
    const val EXTRA_TARGET_ATTEMPTS = "target_attempts"

    // Mirror of intervention-flow.ts: 15 s breathing pause, 5 min access after it.
    private const val PAUSE_SECONDS = 15
    private const val PAUSE_ALLOWANCE_SECONDS = 5 * 60
  }
}
