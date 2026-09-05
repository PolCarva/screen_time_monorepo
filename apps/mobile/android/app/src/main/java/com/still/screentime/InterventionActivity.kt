package com.still.screentime

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Bundle
import android.view.Gravity
import android.view.HapticFeedbackConstants
import android.view.View
import android.view.ViewGroup
import android.widget.LinearLayout
import android.widget.TextView
import java.text.NumberFormat
import java.time.LocalDate
import java.time.ZoneOffset

class InterventionActivity : Activity() {
  private val graphite = Color.rgb(36, 40, 38)
  private val chalk = Color.rgb(241, 239, 232)
  private val mineral = Color.rgb(105, 127, 140)
  private val mineralLight = Color.rgb(167, 181, 186)
  private val peach = Color.rgb(211, 154, 131)

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    window.statusBarColor = graphite
    window.navigationBarColor = graphite
    window.decorView.systemUiVisibility = 0

    val spanish = resources.configuration.locales[0].language == "es"
    val targetPackage = intent.getStringExtra(EXTRA_TARGET_PACKAGE)
    val appLabel = targetPackage?.let {
      runCatching {
        packageManager.getApplicationLabel(packageManager.getApplicationInfo(it, 0)).toString()
      }.getOrNull()
    } ?: if (spanish) "App seleccionada" else "Selected app"
    val day = LocalDate.now(ZoneOffset.UTC).toString()
    val preferences = getSharedPreferences(StillRestrictionModule.PREFERENCES, MODE_PRIVATE)
    if (!preferences.getBoolean(StillRestrictionModule.KEY_RESTRICTIONS_ENABLED, false)) {
      goHome(recordAvoidedOpen = false)
      return
    }

    val attempts = preferences.getInt("open_attempts:$day", 1).coerceAtLeast(1)
    val durationSeconds = preferences
      .getInt(StillRestrictionModule.KEY_UNLOCK_DURATION_SECONDS, 600)
      .coerceIn(60, 86400)
    val durationLabel = when {
      durationSeconds >= 86400 -> if (spanish) "todo el día" else "all day"
      durationSeconds >= 3600 -> if (spanish) "1 hora" else "1 hour"
      else -> (durationSeconds / 60.0).toInt().coerceAtLeast(1).toString() + " min"
    }
    val hasAvailablePass =
      preferences.getInt(StillRestrictionModule.KEY_REWARDED_BALANCE, 0) > 0 ||
        preferences.getInt(StillRestrictionModule.KEY_EMERGENCY_REMAINING, 0) > 0
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
    val secondaryAction = when {
      hasAvailablePass && spanish -> "Usar 1 pase · $durationLabel"
      hasAvailablePass -> "Use 1 pass · $durationLabel"
      spanish -> "Abrir Still para conseguir un pase"
      else -> "Open Still to get a pass"
    }

    val root = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER_HORIZONTAL
      setPadding(dp(28), dp(44), dp(28), dp(28))
      setBackgroundColor(graphite)
    }
    root.addView(View(this), LinearLayout.LayoutParams(1, 0, 1.2f))
    root.addView(createFieldIcon(), LinearLayout.LayoutParams(dp(64), dp(64)))
    root.addView(TextView(this).apply {
      text = observedFact
      gravity = Gravity.CENTER
      textSize = 22f
      typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD)
      setLineSpacing(0f, 1.08f)
      setTextColor(chalk)
      contentDescription = observedFact
    }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
      topMargin = dp(24)
    })
    root.addView(TextView(this).apply {
      text = question + "\n\n" + impactSummary(spanish)
      gravity = Gravity.CENTER
      textSize = 15f
      typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.NORMAL)
      setLineSpacing(dp(3).toFloat(), 1f)
      setTextColor(mineralLight)
      contentDescription = text
    }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
      topMargin = dp(16)
    })
    root.addView(View(this), LinearLayout.LayoutParams(1, 0, 1f))

    root.addView(TextView(this).apply {
      text = if (spanish) "Volver" else "Go back"
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
      contentDescription = text
      setOnClickListener { goHome() }
    }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(54)))
    root.addView(TextView(this).apply {
      text = secondaryAction
      gravity = Gravity.CENTER
      textSize = 15f
      typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD)
      setTextColor(if (hasAvailablePass) chalk else mineralLight)
      isClickable = true
      isFocusable = true
      contentDescription = text
      setOnClickListener {
        val uri = Uri.Builder()
          .scheme("still")
          .authority("intervention")
          .appendQueryParameter("app", appLabel)
          .build()
        startActivity(Intent(Intent.ACTION_VIEW, uri).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP))
        finish()
      }
    }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(52)).apply {
      topMargin = dp(6)
    })
    setContentView(root)
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

  override fun onBackPressed() = goHome()

  private fun goHome(recordAvoidedOpen: Boolean = true) {
    if (recordAvoidedOpen) {
      val preferences = getSharedPreferences(StillRestrictionModule.PREFERENCES, MODE_PRIVATE)
      val key = "avoided_opens:" + LocalDate.now(ZoneOffset.UTC)
      preferences.edit().putInt(key, preferences.getInt(key, 0) + 1).apply()
    }
    startActivity(
      Intent(Intent.ACTION_MAIN)
        .addCategory(Intent.CATEGORY_HOME)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
    )
    finish()
  }

  private fun impactSummary(spanish: Boolean): String {
    val preferences = getSharedPreferences(StillRestrictionModule.PREFERENCES, MODE_PRIVATE)
    val avoidedOpens = preferences.all.entries.sumOf { (key, value) ->
      if (key.startsWith("avoided_opens:")) (value as? Int)?.coerceAtLeast(0) ?: 0 else 0
    }
    val minutesPerOpen =
      preferences.getFloat(StillRestrictionModule.KEY_ESTIMATED_MINUTES_PER_AVOIDED_OPEN, 0f)
    val duration = formatSavedTime(avoidedOpens * minutesPerOpen)
    return if (spanish) {
      "$avoidedOpens aperturas automáticas evitadas · $duration recuperados (est.)"
    } else {
      "$avoidedOpens automatic opens avoided · $duration returned (est.)"
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

  companion object { const val EXTRA_TARGET_PACKAGE = "target_package" }
}
