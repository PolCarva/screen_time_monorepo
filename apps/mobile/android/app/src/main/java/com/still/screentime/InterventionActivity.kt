package com.still.screentime

import android.app.Activity
import android.content.res.ColorStateList
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import java.text.NumberFormat
import java.time.LocalDate
import java.time.ZoneOffset

class InterventionActivity : Activity() {
  private val ink = Color.rgb(23, 24, 20)
  private val muted = Color.rgb(93, 94, 88)
  private val paper = Color.rgb(243, 240, 232)
  private val signal = Color.rgb(255, 92, 53)

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    window.statusBarColor = paper
    window.navigationBarColor = paper
    window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR or View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR
    val pad = dp(28)
    val spanish = resources.configuration.locales[0].language == "es"

    val root = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.START
      setPadding(pad, dp(48), pad, pad)
      setBackgroundColor(paper)
    }
    root.addView(TextView(this).apply {
      text = if (spanish) "STILL / PAUSA 00:10" else "STILL / PAUSE 00:10"
      textSize = 12f
      letterSpacing = 0.16f
      typeface = Typeface.create(Typeface.MONOSPACE, Typeface.BOLD)
      setTextColor(muted)
    })
    root.addView(LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      addView(View(this@InterventionActivity).apply { setBackgroundColor(ink) }, LinearLayout.LayoutParams(dp(5), dp(56)))
      addView(View(this@InterventionActivity), LinearLayout.LayoutParams(dp(5), dp(10)))
      addView(View(this@InterventionActivity).apply { setBackgroundColor(signal) }, LinearLayout.LayoutParams(dp(5), dp(56)))
    }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(48) })
    root.addView(TextView(this).apply {
      text = if (spanish) "Una pausa antes\nde entrar." else "A pause before\nyou enter."
      textSize = 42f
      typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD)
      setLineSpacing(0f, 0.92f)
      setTextColor(ink)
    }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(32) })
    root.addView(TextView(this).apply {
      text = impactSummary(spanish)
      textSize = 13f
      typeface = Typeface.create(Typeface.MONOSPACE, Typeface.NORMAL)
      setTextColor(muted)
    }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(18) })
    root.addView(View(this), LinearLayout.LayoutParams(1, 0, 1f))
    root.addView(Button(this).apply {
      text = if (spanish) "No entrar" else "Don't enter"
      isAllCaps = false
      textSize = 16f
      typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD)
      setTextColor(ink)
      backgroundTintList = ColorStateList.valueOf(signal)
      setOnClickListener { goHome() }
    }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(58)))
    root.addView(Button(this).apply {
      text = if (spanish) "Usar 1 pase · 10 min" else "Use 1 pass · 10 min"
      isAllCaps = false
      textSize = 15f
      typeface = Typeface.create(Typeface.MONOSPACE, Typeface.BOLD)
      setTextColor(ink)
      backgroundTintList = ColorStateList.valueOf(paper)
      background = GradientDrawable().apply {
        setColor(paper)
        setStroke(dp(1), ink)
        cornerRadius = dp(4).toFloat()
      }
      setOnClickListener {
        startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("still://intervention")).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP))
        finish()
      }
    }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(58)).apply { topMargin = dp(12) })
    setContentView(root)
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
    val avoidedOpens = preferences.all.entries.sumOf { (key, value) ->
      if (key.startsWith("avoided_opens:")) (value as? Int)?.coerceAtLeast(0) ?: 0 else 0
    }
    val minutesPerOpen = preferences.getFloat(
      StillRestrictionModule.KEY_ESTIMATED_MINUTES_PER_AVOIDED_OPEN,
      2f,
    )
    val estimatedMinutes = avoidedOpens * minutesPerOpen
    val duration = formatSavedTime(estimatedMinutes)
    return when {
      spanish && avoidedOpens == 1 -> "1 entrada bloqueada · $duration de ahorro estimado"
      spanish -> "$avoidedOpens entradas bloqueadas · $duration de ahorro estimado"
      avoidedOpens == 1 -> "1 entry blocked · $duration saved (est.)"
      else -> "$avoidedOpens entries blocked · $duration saved (est.)"
    }
  }

  private fun formatSavedTime(minutes: Float): String {
    val value = if (minutes < 60) minutes else minutes / 60
    val formatted = NumberFormat.getNumberInstance().apply { maximumFractionDigits = 1 }.format(value)
    return if (minutes < 60) "$formatted min" else "$formatted h"
  }

  private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()

  companion object { const val EXTRA_TARGET_PACKAGE = "target_package" }
}
