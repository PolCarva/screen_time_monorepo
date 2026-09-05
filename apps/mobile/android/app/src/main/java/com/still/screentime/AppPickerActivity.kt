package com.still.screentime

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.EditText
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import java.util.Locale

class AppPickerActivity : Activity() {
  private val graphite = Color.rgb(36, 40, 38)
  private val graphiteSoft = Color.rgb(78, 84, 81)
  private val chalk = Color.rgb(241, 239, 232)
  private val chalkRaised = Color.rgb(248, 246, 239)
  private val mineral = Color.rgb(105, 127, 140)
  private val fog = Color.rgb(217, 222, 220)

  private lateinit var preferences: android.content.SharedPreferences
  private lateinit var selected: MutableSet<String>
  private var originalCount = 0
  private val appRows = mutableListOf<Pair<String, View>>()

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    preferences = getSharedPreferences(StillRestrictionModule.PREFERENCES, Context.MODE_PRIVATE)
    selected = preferences
      .getStringSet(StillRestrictionModule.KEY_SELECTED_PACKAGES, emptySet())
      ?.toMutableSet()
      ?: mutableSetOf()
    originalCount = selected.size

    window.statusBarColor = chalkRaised
    window.navigationBarColor = chalkRaised
    @Suppress("DEPRECATION")
    run {
      window.decorView.systemUiVisibility =
        View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR or View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR
    }

    val spanish = resources.configuration.locales[0].language == "es"
    val launchable = packageManager.getInstalledApplications(0)
      .asSequence()
      .filter {
        it.packageName != packageName && packageManager.getLaunchIntentForPackage(it.packageName) != null
      }
      .sortedBy { packageManager.getApplicationLabel(it).toString().lowercase(Locale.getDefault()) }
      .toList()

    val root = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setBackgroundColor(chalkRaised)
    }
    root.addView(createToolbar(spanish), LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(56)))
    root.addView(View(this).apply { setBackgroundColor(fog) }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(1)))

    val search = EditText(this).apply {
      hint = if (spanish) "Buscar apps" else "Search apps"
      contentDescription = hint
      isSingleLine = true
      textSize = 16f
      typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.NORMAL)
      setTextColor(graphite)
      setHintTextColor(graphiteSoft)
      setPadding(dp(16), 0, dp(16), 0)
      background = roundedBackground(chalk, fog, dp(10).toFloat())
      addTextChangedListener(object : TextWatcher {
        override fun beforeTextChanged(value: CharSequence?, start: Int, count: Int, after: Int) = Unit
        override fun onTextChanged(value: CharSequence?, start: Int, before: Int, count: Int) {
          filterRows(value?.toString().orEmpty())
        }
        override fun afterTextChanged(value: Editable?) = Unit
      })
    }
    root.addView(search, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(46)).apply {
      setMargins(dp(16), dp(12), dp(16), dp(10))
    })

    root.addView(TextView(this).apply {
      text = "APPS"
      textSize = 11f
      letterSpacing = 0.12f
      typeface = Typeface.create(Typeface.MONOSPACE, Typeface.BOLD)
      setTextColor(graphiteSoft)
      setPadding(dp(20), dp(8), dp(20), dp(8))
    })

    val list = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setBackgroundColor(chalkRaised)
    }
    launchable.forEach { app ->
      val label = packageManager.getApplicationLabel(app).toString()
      val row = createAppRow(app.packageName, label)
      appRows += label.lowercase(Locale.getDefault()) to row
      list.addView(row)
    }
    root.addView(ScrollView(this).apply {
      clipToPadding = false
      setBackgroundColor(chalkRaised)
      addView(list)
    }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f))

    setContentView(root)
  }

  private fun createToolbar(spanish: Boolean): View {
    return LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER_VERTICAL
      setPadding(dp(8), 0, dp(8), 0)

      addView(toolbarAction(if (spanish) "Cancelar" else "Cancel", graphiteSoft) {
        setResult(RESULT_CANCELED, Intent().putExtra(RESULT_COUNT, originalCount))
        finish()
      }, LinearLayout.LayoutParams(dp(84), ViewGroup.LayoutParams.MATCH_PARENT))

      addView(TextView(this@AppPickerActivity).apply {
        text = if (spanish) "Elegir apps" else "Choose Apps"
        gravity = Gravity.CENTER
        textSize = 17f
        typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD)
        setTextColor(graphite)
      }, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.MATCH_PARENT, 1f))

      addView(toolbarAction(if (spanish) "Listo" else "Done", mineral) {
        preferences.edit().putStringSet(StillRestrictionModule.KEY_SELECTED_PACKAGES, selected).apply()
        setResult(RESULT_OK, Intent().putExtra(RESULT_COUNT, selected.size))
        finish()
      }, LinearLayout.LayoutParams(dp(84), ViewGroup.LayoutParams.MATCH_PARENT))
    }
  }

  private fun toolbarAction(label: String, color: Int, onClick: () -> Unit) = TextView(this).apply {
    text = label
    gravity = Gravity.CENTER
    textSize = 15f
    typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.NORMAL)
    setTextColor(color)
    isClickable = true
    isFocusable = true
    contentDescription = label
    setOnClickListener { onClick() }
  }

  private fun createAppRow(packageName: String, label: String): View {
    lateinit var indicator: TextView
    fun updateIndicator() {
      val active = packageName in selected
      indicator.text = if (active) "✓" else ""
      indicator.setTextColor(if (active) chalkRaised else Color.TRANSPARENT)
      indicator.background = if (active) {
        GradientDrawable().apply { shape = GradientDrawable.OVAL; setColor(mineral) }
      } else {
        GradientDrawable().apply {
          shape = GradientDrawable.OVAL
          setColor(Color.TRANSPARENT)
          setStroke(dp(1), Color.rgb(167, 181, 186))
        }
      }
    }

    return LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER_VERTICAL
      setPadding(dp(20), 0, dp(20), 0)
      isClickable = true
      isFocusable = true
      contentDescription = label

      addView(ImageView(this@AppPickerActivity).apply {
        setImageDrawable(runCatching { packageManager.getApplicationIcon(packageName) }.getOrNull())
        contentDescription = null
      }, LinearLayout.LayoutParams(dp(34), dp(34)))

      addView(TextView(this@AppPickerActivity).apply {
        text = label
        gravity = Gravity.CENTER_VERTICAL
        textSize = 16f
        typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.NORMAL)
        setTextColor(graphite)
        setPadding(dp(14), 0, dp(12), 0)
      }, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.MATCH_PARENT, 1f))

      indicator = TextView(this@AppPickerActivity).apply {
        gravity = Gravity.CENTER
        textSize = 14f
        typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD)
      }
      addView(indicator, LinearLayout.LayoutParams(dp(24), dp(24)))
      updateIndicator()
      setOnClickListener {
        if (!selected.add(packageName)) selected.remove(packageName)
        updateIndicator()
        contentDescription = "$label, ${if (packageName in selected) "selected" else "not selected"}"
      }
    }.also { row ->
      row.layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(60))
    }
  }

  private fun filterRows(query: String) {
    val normalized = query.trim().lowercase(Locale.getDefault())
    appRows.forEach { (label, row) ->
      row.visibility = if (normalized.isEmpty() || label.contains(normalized)) View.VISIBLE else View.GONE
    }
  }

  private fun roundedBackground(fill: Int, stroke: Int, radius: Float) = GradientDrawable().apply {
    setColor(fill)
    setStroke(dp(1), stroke)
    cornerRadius = radius
  }

  @Deprecated("Deprecated in Java")
  override fun onBackPressed() {
    setResult(RESULT_CANCELED, Intent().putExtra(RESULT_COUNT, originalCount))
    finish()
  }

  private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()

  companion object { const val RESULT_COUNT = "selection_count" }
}
