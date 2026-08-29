package com.still.screentime

import android.app.Activity
import android.content.Intent
import android.content.res.ColorStateList
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Bundle
import android.view.Gravity
import android.view.HapticFeedbackConstants
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import java.text.NumberFormat
import java.time.LocalDate
import java.time.ZoneOffset

class InterventionActivity : Activity() {
  private val graphite = Color.rgb(36, 40, 38)
  private val graphiteSoft = Color.rgb(78, 84, 81)
  private val chalk = Color.rgb(241, 239, 232)
  private val mineral = Color.rgb(105, 127, 140)
  private val mineralLight = Color.rgb(167, 181, 186)
  private val peach = Color.rgb(211, 154, 131)

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    window.statusBarColor = graphite
    window.navigationBarColor = graphite
    window.decorView.systemUiVisibility = 0
    val pad = dp(28)
    val spanish = resources.configuration.locales[0].language == "es"
    val targetPackage = intent.getStringExtra(EXTRA_TARGET_PACKAGE)
    val appLabel = targetPackage?.let {
      runCatching { packageManager.getApplicationLabel(packageManager.getApplicationInfo(it, 0)).toString() }.getOrNull()
    } ?: if (spanish) "App seleccionada" else "Selected app"
    val day = LocalDate.now(ZoneOffset.UTC).toString()
    val preferences = getSharedPreferences(StillRestrictionModule.PREFERENCES, MODE_PRIVATE)
    val attempts = preferences.getInt("open_attempts:$day", 1).coerceAtLeast(1)

    val root = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.START
      setPadding(pad, dp(44), pad, pad)
      setBackgroundColor(graphite)
    }
    root.addView(LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER_VERTICAL
      addView(TextView(this@InterventionActivity).apply {
        text = appLabel.uppercase()
        textSize = 11f
        letterSpacing = 0.12f
        typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD)
        setTextColor(chalk)
      }, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
      addView(TextView(this@InterventionActivity).apply {
        text = "00:01"
        textSize = 12f
        letterSpacing = 0.08f
        typeface = Typeface.create(Typeface.MONOSPACE, Typeface.BOLD)
        setTextColor(chalk)
      })
    })

    root.addView(createAttentionField(), LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(184)).apply { topMargin = dp(30) })

    root.addView(TextView(this).apply {
      text = if (spanish) "$appLabel se abrió\n$attempts ${if (attempts == 1) "vez" else "veces"} hoy." else "$appLabel opened\n$attempts ${if (attempts == 1) "time" else "times"} today."
      textSize = 36f
      typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD)
      setLineSpacing(0f, 1.02f)
      setTextColor(chalk)
    }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
    root.addView(TextView(this).apply {
      text = if (spanish) "¿Qué quieres de los próximos 10 minutos?" else "What do you want from the next 10 minutes?"
      textSize = 14f
      typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.NORMAL)
      setTextColor(mineralLight)
    }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(18) })
    root.addView(View(this), LinearLayout.LayoutParams(1, 0, 1f))

    root.addView(Button(this).apply {
      text = if (spanish) "Volver" else "Go back"
      isAllCaps = false
      textSize = 16f
      typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD)
      setTextColor(graphite)
      backgroundTintList = ColorStateList.valueOf(chalk)
      setOnClickListener { goHome() }
    }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(58)))
    root.addView(Button(this).apply {
      text = if (spanish) "Usar 1 pase · 10 min  →" else "Use 1 pass · 10 min  →"
      isAllCaps = false
      textSize = 15f
      gravity = Gravity.CENTER_VERTICAL or Gravity.START
      typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD)
      setTextColor(chalk)
      background = GradientDrawable().apply {
        setColor(graphite)
        setStroke(dp(1), graphiteSoft)
        cornerRadius = 0f
      }
      setOnClickListener {
        val uri = Uri.Builder().scheme("still").authority("intervention").appendQueryParameter("app", appLabel).build()
        startActivity(Intent(Intent.ACTION_VIEW, uri).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP))
        finish()
      }
    }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(64)).apply { topMargin = dp(8) })
    root.addView(TextView(this).apply {
      text = impactSummary(spanish)
      textSize = 11f
      typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.NORMAL)
      setTextColor(mineralLight)
    }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(16) })
    setContentView(root)
  }

  private fun createAttentionField(): View {
    val field = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; gravity = Gravity.CENTER }
    repeat(6) { row ->
      val line = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER }
      val left = module(if (row == 3) mineral else mineralLight, 0.48f + (row % 3) * 0.16f)
      val right = module(if (row == 3) peach else mineralLight, 0.48f + ((row + 1) % 3) * 0.16f)
      line.addView(left, LinearLayout.LayoutParams(dp(72), dp(11)))
      line.addView(View(this), LinearLayout.LayoutParams(if (row == 3) dp(70) else dp(42), dp(1)))
      line.addView(right, LinearLayout.LayoutParams(dp(72), dp(11)))
      field.addView(line, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(22)))
      if (row == 3) {
        left.translationX = dp(14).toFloat()
        right.translationX = -dp(14).toFloat()
        left.animate().translationX(0f).setDuration(520).start()
        right.animate().translationX(0f).setDuration(520).withEndAction { field.performHapticFeedback(HapticFeedbackConstants.CLOCK_TICK) }.start()
      }
    }
    return field
  }

  private fun module(color: Int, opacity: Float) = View(this).apply {
    alpha = opacity
    background = GradientDrawable().apply { setColor(color); cornerRadius = dp(3).toFloat() }
  }

  override fun onBackPressed() = goHome()

  private fun goHome() {
    val preferences = getSharedPreferences(StillRestrictionModule.PREFERENCES, MODE_PRIVATE)
    val key = "avoided_opens:${LocalDate.now(ZoneOffset.UTC)}"
    preferences.edit().putInt(key, preferences.getInt(key, 0) + 1).apply()
    startActivity(Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    finish()
  }

  private fun impactSummary(spanish: Boolean): String {
    val preferences = getSharedPreferences(StillRestrictionModule.PREFERENCES, MODE_PRIVATE)
    val avoidedOpens = preferences.all.entries.sumOf { (key, value) -> if (key.startsWith("avoided_opens:")) (value as? Int)?.coerceAtLeast(0) ?: 0 else 0 }
    val minutesPerOpen = preferences.getFloat(StillRestrictionModule.KEY_ESTIMATED_MINUTES_PER_AVOIDED_OPEN, 2f)
    val duration = formatSavedTime(avoidedOpens * minutesPerOpen)
    return if (spanish) "$avoidedOpens aperturas automáticas evitadas · $duration recuperados (est.)" else "$avoidedOpens automatic opens avoided · $duration returned (est.)"
  }

  private fun formatSavedTime(minutes: Float): String {
    val value = if (minutes < 60) minutes else minutes / 60
    val formatted = NumberFormat.getNumberInstance().apply { maximumFractionDigits = 1 }.format(value)
    return if (minutes < 60) "$formatted min" else "$formatted h"
  }

  private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()
  companion object { const val EXTRA_TARGET_PACKAGE = "target_package" }
}
