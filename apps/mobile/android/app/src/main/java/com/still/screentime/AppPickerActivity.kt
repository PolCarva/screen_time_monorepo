package com.still.screentime

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.graphics.Color
import android.os.Bundle
import android.view.ViewGroup
import android.widget.Button
import android.widget.CheckBox
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView

class AppPickerActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val density = resources.displayMetrics.density
    val padding = (22 * density).toInt()
    val prefs = getSharedPreferences(StillRestrictionModule.PREFERENCES, Context.MODE_PRIVATE)
    val selected = prefs.getStringSet(StillRestrictionModule.KEY_SELECTED_PACKAGES, emptySet())?.toMutableSet() ?: mutableSetOf()
    val launchable = packageManager.getInstalledApplications(0)
      .asSequence()
      .filter { it.packageName != packageName && packageManager.getLaunchIntentForPackage(it.packageName) != null }
      .sortedBy { packageManager.getApplicationLabel(it).toString().lowercase() }
      .toList()

    val list = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(padding, padding, padding, padding) }
    list.addView(TextView(this).apply { text = if (resources.configuration.locales[0].language == "es") "Elige tus pausas" else "Choose your pauses"; textSize = 34f; setTextColor(Color.rgb(52, 66, 55)); setPadding(0, 0, 0, padding) })
    launchable.forEach { app -> list.addView(checkBoxFor(app, selected)) }
    list.addView(Button(this).apply {
      text = if (resources.configuration.locales[0].language == "es") "Guardar selección" else "Save selection"
      isAllCaps = false
      setOnClickListener {
        prefs.edit().putStringSet(StillRestrictionModule.KEY_SELECTED_PACKAGES, selected).apply()
        setResult(RESULT_OK, Intent().putExtra(RESULT_COUNT, selected.size))
        finish()
      }
    }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, (62 * density).toInt()).apply { topMargin = padding })
    setContentView(ScrollView(this).apply { setBackgroundColor(Color.rgb(246, 244, 241)); addView(list) })
  }

  private fun checkBoxFor(app: ApplicationInfo, selected: MutableSet<String>) = CheckBox(this).apply {
    text = packageManager.getApplicationLabel(app)
    textSize = 16f
    isChecked = app.packageName in selected
    setPadding(0, 8, 0, 8)
    setOnCheckedChangeListener { _, checked -> if (checked) selected.add(app.packageName) else selected.remove(app.packageName) }
  }

  companion object { const val RESULT_COUNT = "selection_count" }
}
