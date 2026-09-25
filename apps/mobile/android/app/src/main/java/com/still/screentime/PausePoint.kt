package com.still.screentime

/**
 * Where the shield's breathing pause stood the last time it was on screen:
 * the boot it belongs to, when that was (`elapsedRealtime`) and the seconds
 * still to breathe. The pause only runs while the shield is up, so a shield
 * opened again picks it up with the same seconds left, never fewer: closing
 * the shield and reopening the app later must not skip the pause. Pure Kotlin
 * so PausePointTest pins it down.
 */
data class PausePoint(val boot: Int, val savedAtMillis: Long, val secondsLeft: Int) {
  fun encode(): String = "$boot:$savedAtMillis:$secondsLeft"

  /**
   * The seconds left for a shield opening at [nowMillis] on [boot], or null
   * when this pause is over: another boot, a clock that went backwards, or
   * more than [graceSeconds] away from the shield.
   */
  fun secondsLeftAt(boot: Int, nowMillis: Long, graceSeconds: Long): Int? {
    if (boot != this.boot) return null
    val away = nowMillis - savedAtMillis
    if (away < 0 || away > graceSeconds * 1_000L) return null
    return secondsLeft
  }

  companion object {
    /**
     * Null for anything else, including the "boot:startedAt" an older build
     * wrote: that pause is dropped and the gate starts over, never shortened.
     */
    fun decode(value: String?): PausePoint? {
      val parts = value?.split(':') ?: return null
      if (parts.size != 3) return null
      val boot = parts[0].toIntOrNull() ?: return null
      val savedAt = parts[1].toLongOrNull() ?: return null
      val left = parts[2].toIntOrNull()?.takeIf { it >= 0 } ?: return null
      return PausePoint(boot, savedAt, left)
    }
  }
}
