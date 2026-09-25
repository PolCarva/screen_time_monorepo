package com.still.screentime

import android.content.Context
import java.io.File
import org.json.JSONObject

/**
 * Minutes one skipped pause gives back, per app, as React Native measured them
 * from the phone's usage (docs/real-savings-estimate-plan.md §3.1, D8). They
 * are derived from usage, so they live in `noBackupFilesDir`, never in the
 * preferences that Android Auto Backup copies. Apps without a measure fall
 * back to the config's minutes.
 */
object SessionMinutes {
  private const val FILE_NAME = "session-minutes.json"

  fun write(context: Context, minutes: Map<String, Double>) {
    val directory = context.noBackupFilesDir
    val staged = File(directory, "$FILE_NAME.tmp")
    staged.writeText(JSONObject(minutes).toString())
    if (!staged.renameTo(File(directory, FILE_NAME))) staged.delete()
  }

  fun read(context: Context, packageName: String): Float? = runCatching {
    val file = File(context.noBackupFilesDir, FILE_NAME)
    if (!file.exists()) return null
    val json = JSONObject(file.readText())
    if (!json.has(packageName)) return null
    json.getDouble(packageName).toFloat().takeIf { it.isFinite() && it >= 0f }
  }.getOrNull()

  fun clear(context: Context) {
    File(context.noBackupFilesDir, FILE_NAME).delete()
  }
}
