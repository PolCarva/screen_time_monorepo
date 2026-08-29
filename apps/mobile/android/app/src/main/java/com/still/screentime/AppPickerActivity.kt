package com.still.screentime

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.res.ColorStateList
import android.content.pm.ApplicationInfo
import android.graphics.Color
import android.graphics.Typeface
import android.os.Bundle
import android.view.ViewGroup
import android.widget.Button
import android.widget.CheckBox
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView

class AppPickerActivity : Activity() {
  private val ink = Color.rgb(23, 24, 20)
  private val muted = Color.rgb(93, 94, 88)
  private val paper = Color.rgb(243, 240, 232)
  private val signal = Color.rgb(255, 92, 53)

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val density = resources.displayMetrics.density
    val padding = (28 * density).toInt()
    val prefs = getSharedPreferences(StillRestrictionModule.PREFERENCES, Context.MODE_PRIVATE)
    val selected = prefs.getStringSet(StillRestrictionModule.KEY_SELECTED_PACKAGES, emptySet())?.toMutableSet() ?: mutableSetOf()
    val launchable = packageManager.getInstalledApplications(0)
      .asSequence()
      .filter { it.packageName != packageName && packageManager.getLaunchIntentForPackage(it.packageName) != null }
      .sortedBy { packageManager.getApplicationLabel(it).toString().lowercase() }
      .toList()

    val spanish = resources.configuration.locales[0].language == "es"
    window.statusBarColor = paper
    window.navigationBarColor = paper
    val list = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(padding, padding * 2, padding, padding) }
    list.addView(TextView(this).apply {
      text = if (spanish) "RESTRICCIONES / APPS" else "RESTRICTIONS / APPS"
      textSize = 11f
      letterSpacing = 0.14f
      typeface = Typeface.create(Typeface.MONOSPACE, Typeface.BOLD)
      setTextColor(muted)
    })
    list.addView(TextView(this).apply {
      text = if (spanish) "Elige dónde\nponer la pausa." else "Choose where\nto place the pause."
      textSize = 38f
      typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD)
      setTextColor(ink)
      setPadding(0, padding / 2, 0, padding)
    })
    launchable.forEach { app -> list.addView(checkBoxFor(app, selected)) }
    list.addView(Button(this).apply {
      text = if (resources.configuration.locales[0].language == "es") "Guardar selección" else "Save selection"
      isAllCaps = false
      textSize = 16f
      typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD)
      setTextColor(ink)
      backgroundTintList = ColorStateList.valueOf(signal)
      setOnClickListener {
        prefs.edit().putStringSet(StillRestrictionModule.KEY_SELECTED_PACKAGES, selected).apply()
        setResult(RESULT_OK, Intent().putExtra(RESULT_COUNT, selected.size))
        finish()
      }
    }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, (62 * density).toInt()).apply { topMargin = padding })
    setContentView(ScrollView(this).apply { setBackgroundColor(paper); addView(list) })
  }

  private fun checkBoxFor(app: ApplicationInfo, selected: MutableSet<String>) = CheckBox(this).apply {
    text = packageManager.getApplicationLabel(app)
    textSize = 16f
    typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.NORMAL)
    buttonTintList = ColorStateList.valueOf(signal)
    setTextColor(ink)
    isChecked = app.packageName in selected
    setPadding(0, 8, 0, 8)
    setOnCheckedChangeListener { _, checked -> if (checked) selected.add(app.packageName) else selected.remove(app.packageName) }
  }

  companion object { const val RESULT_COUNT = "selection_count" }
}
