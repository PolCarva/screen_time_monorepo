package com.still.screentime

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.view.Gravity
import android.view.ViewGroup
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import java.time.LocalDate
import java.time.ZoneOffset

class InterventionActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    window.statusBarColor = Color.rgb(246, 244, 241)
    window.navigationBarColor = Color.rgb(246, 244, 241)
    val density = resources.displayMetrics.density
    val pad = (28 * density).toInt()
    val spanish = resources.configuration.locales[0].language == "es"

    val root = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER_HORIZONTAL
      setPadding(pad, pad * 2, pad, pad)
      setBackgroundColor(Color.rgb(246, 244, 241))
    }
    root.addView(TextView(this).apply {
      text = "⌁"
      textSize = 72f
      gravity = Gravity.CENTER
      setTextColor(Color.rgb(52, 66, 55))
    }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f))
    root.addView(TextView(this).apply {
      text = if (spanish) "¿Realmente quieres abrir esta app?" else "Do you really want to open this app?"
      textSize = 34f
      gravity = Gravity.CENTER
      setTextColor(Color.rgb(52, 66, 55))
      setPadding(0, 0, 0, pad)
    })
    root.addView(Button(this).apply {
      text = if (spanish) "Ahora no" else "Not now"
      isAllCaps = false
      setOnClickListener { goHome() }
    }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, (56 * density).toInt()))
    root.addView(Button(this).apply {
      text = if (spanish) "Abrir Still para desbloquear" else "Open Still to unlock"
      isAllCaps = false
      setOnClickListener {
        startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("still://intervention")).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP))
        finish()
      }
    }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, (64 * density).toInt()).apply { topMargin = (12 * density).toInt() })
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

  companion object { const val EXTRA_TARGET_PACKAGE = "target_package" }
}
