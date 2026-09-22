package com.still.screentime

import android.content.SharedPreferences
import com.still.screentime.StillRestrictionModule.Companion.KEY_CURRENT_PACKAGE
import com.still.screentime.StillRestrictionModule.Companion.KEY_SELECTED_PACKAGES

/**
 * Safety boundary that keeps Still outside its own restriction engine.
 *
 * The event-time check remains authoritative. Persisted state is also cleaned so
 * selections written by an older build, restored backup, or corrupted preference
 * cannot make Still a restriction target later.
 */
internal object StillSelfProtection {
  fun isOwnPackage(ownPackage: String, candidate: String?): Boolean =
    candidate == ownPackage

  fun withoutOwnPackage(ownPackage: String, packages: Iterable<String>): Set<String> =
    packages.filterTo(linkedSetOf()) { candidate ->
      candidate.isNotBlank() && !isOwnPackage(ownPackage, candidate)
    }

  fun sanitizePreferences(
    preferences: SharedPreferences,
    ownPackage: String,
  ): Set<String> {
    val stored = preferences.getStringSet(KEY_SELECTED_PACKAGES, emptySet()) ?: emptySet()
    val safe = withoutOwnPackage(ownPackage, stored)
    val currentIsOwn = isOwnPackage(
      ownPackage,
      preferences.getString(KEY_CURRENT_PACKAGE, null),
    )
    val ownSessionKeys = preferences.all
      .filter { (key, value) -> key.startsWith("session:") && value == ownPackage }
      .keys
    val hasOwnUnlockState =
      preferences.contains("unlocked:$ownPackage") ||
        preferences.contains("unlocked_boot:$ownPackage")

    if (safe != stored || currentIsOwn || ownSessionKeys.isNotEmpty() || hasOwnUnlockState) {
      val editor = preferences.edit().putStringSet(KEY_SELECTED_PACKAGES, safe)
      if (currentIsOwn) editor.remove(KEY_CURRENT_PACKAGE)
      editor
        .remove("unlocked:$ownPackage")
        .remove("unlocked_boot:$ownPackage")
      ownSessionKeys.forEach(editor::remove)
      editor.apply()
    }

    return safe
  }

  fun clearOwnTarget(preferences: SharedPreferences, ownPackage: String) {
    val safe = withoutOwnPackage(
      ownPackage,
      preferences.getStringSet(KEY_SELECTED_PACKAGES, emptySet()) ?: emptySet(),
    )
    val editor = preferences.edit()
      .putStringSet(KEY_SELECTED_PACKAGES, safe)
      .remove("unlocked:$ownPackage")
      .remove("unlocked_boot:$ownPackage")
    if (isOwnPackage(ownPackage, preferences.getString(KEY_CURRENT_PACKAGE, null))) {
      editor.remove(KEY_CURRENT_PACKAGE)
    }
    preferences.all
      .filter { (key, value) -> key.startsWith("session:") && value == ownPackage }
      .keys
      .forEach(editor::remove)
    editor.apply()
  }
}
