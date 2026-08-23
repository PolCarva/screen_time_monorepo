import DeviceActivity

final class DeviceActivityMonitorExtension: DeviceActivityMonitor {
  override func intervalDidStart(for activity: DeviceActivityName) {
    super.intervalDidStart(for: activity)
    SharedRestrictionState.restoreExpired()
  }

  override func intervalDidEnd(for activity: DeviceActivityName) {
    super.intervalDidEnd(for: activity)
    if activity.rawValue.hasPrefix("still.unlock.") {
      SharedRestrictionState.restore(sessionId: String(activity.rawValue.dropFirst("still.unlock.".count)))
    } else {
      SharedRestrictionState.restoreExpired()
    }
  }
}
