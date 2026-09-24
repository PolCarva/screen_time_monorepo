package com.still.screentime

import android.app.Activity
import android.graphics.Color
import android.os.Build
import android.view.View
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat

/**
 * Android 15+ draws every activity edge to edge once the app targets SDK 35
 * (Still targets 36): the status bar, the navigation bar and the keyboard no
 * longer push content out of the way. Still's native screens opt in on every
 * version and pad themselves, so they sit inside the same safe area on
 * Android 10 and on Android 16.
 */
internal object StillInsets {
  data class Edges(val left: Int, val top: Int, val right: Int, val bottom: Int)

  /** Transparent bars over the screen's own background; [lightBars] = dark icons. */
  fun drawEdgeToEdge(activity: Activity, lightBars: Boolean) {
    val window = activity.window
    WindowCompat.setDecorFitsSystemWindows(window, false)
    @Suppress("DEPRECATION")
    run {
      window.statusBarColor = Color.TRANSPARENT
      window.navigationBarColor = Color.TRANSPARENT
    }
    // The screen paints behind the bars itself, so the system's translucent
    // scrim over three-button navigation would only muddy that colour.
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      window.isNavigationBarContrastEnforced = false
      window.isStatusBarContrastEnforced = false
    }
    WindowCompat.getInsetsController(window, window.decorView).apply {
      isAppearanceLightStatusBars = lightBars
      isAppearanceLightNavigationBars = lightBars
    }
  }

  /**
   * Calls [apply] with what the system bars, the display cutout and, at the
   * bottom, the keyboard cover, now and every time that changes.
   */
  fun onEdges(view: View, apply: (Edges) -> Unit) {
    ViewCompat.setOnApplyWindowInsetsListener(view) { _, insets ->
      val bars = insets.getInsets(
        WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout(),
      )
      val keyboard = insets.getInsets(WindowInsetsCompat.Type.ime())
      apply(Edges(bars.left, bars.top, bars.right, maxOf(bars.bottom, keyboard.bottom)))
      insets
    }
    if (view.isAttachedToWindow) ViewCompat.requestApplyInsets(view)
  }
}
