import DeviceActivity
import FamilyControls
import Foundation
import ManagedSettings
import UserNotifications

enum SharedRestrictionState {
  static let appGroup = "group.com.still.screentime"
  static let defaults = UserDefaults(suiteName: appGroup)!
  static let store = ManagedSettingsStore(named: .init("still.restrictions"))
  private static let selectionKey = "familyActivitySelection"
  private static let sessionsKey = "unlockSessions"
  private static let pendingTargetKey = "pendingApplicationToken"
  private static let pendingTargetKindKey = "pendingRestrictionTargetKind"
  private static let pendingRechargeKey = "pendingRechargeRequest"
  private static let walletKey = "localWallet"
  private static let unlockOutboxKey = "nativeUnlockOutbox"
  private static let estimatedMinutesPerAvoidedOpenKey = "estimatedMinutesPerAvoidedOpen"
  private static let unlockDurationSecondsKey = "unlockDurationSeconds"
  private static let restrictionsEnabledKey = "restrictionsEnabled"
  private static let shortcutModeEnabledKey = "shortcutModeEnabled"
  private static let targetProductMetricsPrefix = "targetProductMetrics:"
  static let currentShieldMetricScopeKey = "currentShieldMetricScope"
  static let windowEndNotificationPrefix = "still.window-ended."
  /// DeviceActivity refuses schedules shorter than this, so a shorter window
  /// keeps its own exact deadline and uses a 15-minute monitor as a fail-safe.
  private static let minimumMonitorSeconds: TimeInterval = 15 * 60
  private static let externalBrowserBypassUntilKey = "externalBrowserBypassUntil"
  static let externalBrowserActivity = DeviceActivityName("still.external-browser")

  static var restrictionsEnabled: Bool {
    guard defaults.object(forKey: restrictionsEnabledKey) != nil else { return false }
    return defaults.bool(forKey: restrictionsEnabledKey)
  }

  static var shortcutModeEnabled: Bool {
    defaults.bool(forKey: shortcutModeEnabledKey)
  }

  static func setShortcutModeEnabled(_ enabled: Bool) {
    defaults.set(enabled, forKey: shortcutModeEnabledKey)
    if enabled {
      store.clearAllSettings()
    } else {
      applyShields()
    }
    flush()
  }

  static var unlockDurationSeconds: Int {
    let stored = defaults.integer(forKey: unlockDurationSecondsKey)
    return max(60, min(stored > 0 ? stored : 600, 86_400))
  }

  struct UnlockRecord: Codable {
    let tokenKey: String
    let targetKind: String?
    let deadlineUptime: TimeInterval
    let bootEpoch: TimeInterval
  }

  /// Saved passes only: emergency access was removed. A wallet written by an
  /// older build still decodes, because its extra `emergency` key is ignored.
  struct LocalWallet: Codable {
    var rewarded: Int
    var resetAt: Date
  }

  struct NativeUnlockEvent: Codable {
    let clientSessionId: String
    let source: String
    let durationSeconds: Int
    let startedAt: Date
  }

  struct DailyProductMetrics: Codable {
    var openAttempts = 0
    var avoidedOpens = 0
    var unlocks = 0
  }

  enum PendingTarget {
    case application(ApplicationToken)
    case category(ActivityCategoryToken)
    case webDomain(WebDomainToken)
  }

  static func metricScope(application token: ApplicationToken) -> String {
    "application:\(tokenKey(token))"
  }

  static func metricScope(category token: ActivityCategoryToken) -> String {
    "category:\(tokenKey(token))"
  }

  static func metricScope(webDomain token: WebDomainToken) -> String {
    "webDomain:\(tokenKey(token))"
  }

  static func currentShieldMetricScope(fallback: String) -> String {
    defaults.string(forKey: currentShieldMetricScopeKey) ?? fallback
  }

  static var selection: FamilyActivitySelection {
    get {
      guard let data = defaults.data(forKey: selectionKey),
        let decoded = try? PropertyListDecoder().decode(FamilyActivitySelection.self, from: data)
      else { return FamilyActivitySelection() }
      return decoded
    }
    set {
      guard let data = try? PropertyListEncoder().encode(newValue) else { return }
      defaults.set(data, forKey: selectionKey)
    }
  }

  static func applyShields() {
    guard restrictionsEnabled, !shortcutModeEnabled else {
      store.clearAllSettings()
      return
    }
    pruneExpiredSessions()
    if externalBrowserBypassActive {
      store.clearAllSettings()
      return
    }
    let sessions = loadSessions().values
    let activeApplications = Set(
      sessions.filter { $0.targetKind == nil || $0.targetKind == "application" }.map(\.tokenKey))
    let activeCategories = Set(sessions.filter { $0.targetKind == "category" }.map(\.tokenKey))
    let activeWebDomains = Set(sessions.filter { $0.targetKind == "webDomain" }.map(\.tokenKey))
    let chosen = selection
    store.shield.applications = Set(
      chosen.applicationTokens.filter { !activeApplications.contains(tokenKey($0)) })
    let shieldedCategories = Set(
      chosen.categoryTokens.filter { !activeCategories.contains(tokenKey($0)) })
    store.shield.applicationCategories =
      shieldedCategories.isEmpty ? nil : .specific(shieldedCategories)
    store.shield.webDomains = Set(
      chosen.webDomainTokens.filter { !activeWebDomains.contains(tokenKey($0)) })
  }

  static func beginUnlock(
    application token: ApplicationToken, durationSeconds: Int, scheduleMonitoring: Bool = true
  ) throws -> (String, Date) {
    try beginUnlock(
      targetKind: "application", tokenKey: tokenKey(token), durationSeconds: durationSeconds,
      scheduleMonitoring: scheduleMonitoring)
  }

  static func beginUnlock(
    category token: ActivityCategoryToken, durationSeconds: Int, scheduleMonitoring: Bool = true
  ) throws -> (String, Date) {
    try beginUnlock(
      targetKind: "category", tokenKey: tokenKey(token), durationSeconds: durationSeconds,
      scheduleMonitoring: scheduleMonitoring)
  }

  static func beginUnlock(
    webDomain token: WebDomainToken, durationSeconds: Int, scheduleMonitoring: Bool = true
  ) throws -> (String, Date) {
    try beginUnlock(
      targetKind: "webDomain", tokenKey: tokenKey(token), durationSeconds: durationSeconds,
      scheduleMonitoring: scheduleMonitoring)
  }

  private static func beginUnlock(
    targetKind: String, tokenKey: String, durationSeconds: Int, scheduleMonitoring: Bool
  ) throws -> (String, Date) {
    guard restrictionsEnabled else {
      throw NSError(
        domain: "StillRestrictionEngine", code: 2,
        userInfo: [NSLocalizedDescriptionKey: "Restrictions are temporarily disabled"])
    }
    let duration = max(60, min(durationSeconds, 86_400))
    let id = UUID().uuidString
    let deadline = ProcessInfo.processInfo.systemUptime + TimeInterval(duration)
    let now = Date()
    let end = now.addingTimeInterval(TimeInterval(duration))
    if scheduleMonitoring {
      let calendar = Calendar.current
      // A 24-hour interval has identical clock components at both ends, which
      // DeviceActivity rejects. Ending its monitor one second earlier keeps
      // the all-day choice effectively intact while preserving auto-restore.
      //
      // Windows shorter than 15 minutes are rejected outright, so the monitor
      // is floored there. It is only the fail-safe that restores shields; the
      // window the user chose is `deadlineUptime`, which `applyShields` and
      // `pruneExpiredSessions` enforce to the second.
      let monitorSeconds = max(TimeInterval(duration), minimumMonitorSeconds)
      let monitorEnd =
        duration >= 86_400
        ? end.addingTimeInterval(-1) : now.addingTimeInterval(monitorSeconds)
      let schedule = DeviceActivitySchedule(
        intervalStart: calendar.dateComponents([.hour, .minute, .second], from: now),
        intervalEnd: calendar.dateComponents([.hour, .minute, .second], from: monitorEnd),
        repeats: false
      )
      try DeviceActivityCenter().startMonitoring(.init("still.unlock.\(id)"), during: schedule)
    }

    // Persist only after DeviceActivity accepts the schedule. Otherwise a
    // failed start would leave a phantom session that suppresses the Shield.
    var sessions = loadSessions()
    sessions[id] = UnlockRecord(
      tokenKey: tokenKey, targetKind: targetKind, deadlineUptime: deadline, bootEpoch: bootEpoch())
    saveSessions(sessions)
    scheduleWindowEndNotification(key: tokenKey, appName: nil, at: end)
    return (id, end)
  }

  /// Announces the exact second a window ends.
  ///
  /// The window itself is never extended: it is stored as a deadline and
  /// checked against the clock, so the app is paused again from that instant
  /// on. What this adds is the one thing iOS will not do by itself — tell the
  /// user while they are still inside the app. A time-sensitive notification
  /// breaks through Focus, and opening Still from it brings the pause back.
  static func scheduleWindowEndNotification(key: String, appName: String?, at end: Date) {
    let identifier = windowEndNotificationPrefix + key
    let center = UNUserNotificationCenter.current()
    center.removePendingNotificationRequests(withIdentifiers: [identifier])
    let seconds = end.timeIntervalSinceNow
    guard seconds > 0 else { return }

    let spanish = Locale.preferredLanguages.first?.hasPrefix("es") == true
    let content = UNMutableNotificationContent()
    if let appName {
      content.title =
        spanish ? "Se cumplió tu tiempo en \(appName)" : "Your time in \(appName) is up"
      content.body =
        spanish
        ? "Still ya volvió a pausar \(appName). Ábrela otra vez si quieres decidir de nuevo."
        : "Still has paused \(appName) again. Open it again if you want to decide once more."
    } else {
      content.title = spanish ? "Se cumplió tu tiempo" : "Your time is up"
      content.body =
        spanish
        ? "Still ya volvió a pausar la app. Ábrela otra vez si quieres decidir de nuevo."
        : "Still has paused the app again. Open it again if you want to decide once more."
    }
    content.sound = .default
    content.interruptionLevel = .timeSensitive
    content.userInfo = ["route": "window_ended"]

    center.add(
      UNNotificationRequest(
        identifier: identifier,
        content: content,
        trigger: UNTimeIntervalNotificationTrigger(timeInterval: seconds, repeats: false)
      ),
      withCompletionHandler: nil
    )
  }

  static func cancelWindowEndNotification(key: String) {
    UNUserNotificationCenter.current().removePendingNotificationRequests(
      withIdentifiers: [windowEndNotificationPrefix + key])
  }

  /// Managed-mode windows still running, as wall-clock deadlines. Derived from
  /// the monotonic deadline so a clock change cannot extend one.
  static func activeWindowEnds() -> [Date] {
    pruneExpiredSessions()
    let uptime = ProcessInfo.processInfo.systemUptime
    return loadSessions().values
      .map { Date().addingTimeInterval($0.deadlineUptime - uptime) }
      .sorted()
  }

  static func restore(sessionId: String) {
    var sessions = loadSessions()
    if let record = sessions.removeValue(forKey: sessionId) {
      cancelWindowEndNotification(key: record.tokenKey)
    }
    saveSessions(sessions)
    defaults.set(ISO8601DateFormatter().string(from: Date()), forKey: "lastRestoredAt")
    applyShields()
  }

  static func restoreExpired() {
    if !externalBrowserBypassActive {
      defaults.removeObject(forKey: externalBrowserBypassUntilKey)
    }
    pruneExpiredSessions()
    applyShields()
  }

  static func beginExternalBrowserBypass(
    durationSeconds: Int = 600,
    scheduleMonitoring: Bool = true
  ) throws {
    let duration = max(60, min(durationSeconds, 600))
    let now = Date()
    let end = now.addingTimeInterval(TimeInterval(duration))
    if scheduleMonitoring {
      // DeviceActivity rejects schedules shorter than 15 minutes. The stored
      // bypass still expires after `duration`; this longer monitor is only the
      // native fail-safe that restores shields if JavaScript never resumes.
      let monitorEnd = now.addingTimeInterval(max(TimeInterval(duration), 15 * 60))
      let calendar = Calendar.current
      let schedule = DeviceActivitySchedule(
        intervalStart: calendar.dateComponents([.hour, .minute, .second], from: now),
        intervalEnd: calendar.dateComponents([.hour, .minute, .second], from: monitorEnd),
        repeats: false
      )
      let center = DeviceActivityCenter()
      center.stopMonitoring([externalBrowserActivity])
      try center.startMonitoring(externalBrowserActivity, during: schedule)
    }

    defaults.set(end, forKey: externalBrowserBypassUntilKey)
    store.clearAllSettings()
    flush()
  }

  static func endExternalBrowserBypass() {
    DeviceActivityCenter().stopMonitoring([externalBrowserActivity])
    defaults.removeObject(forKey: externalBrowserBypassUntilKey)
    applyShields()
    flush()
  }

  static func resetLocalData() {
    DeviceActivityCenter().stopMonitoring()
    store.clearAllSettings()
    UNUserNotificationCenter.current().removeAllPendingNotificationRequests()
    UNUserNotificationCenter.current().removeAllDeliveredNotifications()
    defaults.removePersistentDomain(forName: appGroup)
    defaults.synchronize()
  }

  static func savePendingTarget(_ token: ApplicationToken) {
    savePendingTarget(token, kind: "application")
  }

  static func savePendingTarget(_ token: ActivityCategoryToken) {
    savePendingTarget(token, kind: "category")
  }

  static func savePendingTarget(_ token: WebDomainToken) {
    savePendingTarget(token, kind: "webDomain")
  }

  private static func savePendingTarget<T: Encodable>(_ token: T, kind: String) {
    defaults.set(try? JSONEncoder().encode(token), forKey: pendingTargetKey)
    defaults.set(kind, forKey: pendingTargetKindKey)
  }

  static func pendingTarget() -> PendingTarget? {
    guard let data = defaults.data(forKey: pendingTargetKey) else { return nil }
    switch defaults.string(forKey: pendingTargetKindKey) ?? "application" {
    case "category":
      return try? .category(JSONDecoder().decode(ActivityCategoryToken.self, from: data))
    case "webDomain":
      return try? .webDomain(JSONDecoder().decode(WebDomainToken.self, from: data))
    default:
      return try? .application(JSONDecoder().decode(ApplicationToken.self, from: data))
    }
  }

  static func clearPendingTarget() {
    defaults.removeObject(forKey: pendingTargetKey)
    defaults.removeObject(forKey: pendingTargetKindKey)
    defaults.removeObject(forKey: pendingRechargeKey)
  }

  static var hasPendingTarget: Bool { defaults.data(forKey: pendingTargetKey) != nil }

  @discardableResult
  static func markRechargeRequested() -> String {
    let requestId = UUID().uuidString
    defaults.set(requestId, forKey: pendingRechargeKey)
    return requestId
  }

  static func pendingRechargeRequestId() -> String? {
    if let requestId = defaults.string(forKey: pendingRechargeKey) {
      return requestId
    }
    // Migrate recharge requests written by older builds as a Boolean.
    guard defaults.bool(forKey: pendingRechargeKey) else { return nil }
    let requestId = UUID().uuidString
    defaults.set(requestId, forKey: pendingRechargeKey)
    return requestId
  }

  static func syncWallet(
    rewarded: Int,
    resetAt: Date,
    estimatedMinutesPerAvoidedOpen: Double,
    unlockDurationSeconds: Int,
    restrictionsEnabled: Bool
  ) {
    let wallet = LocalWallet(rewarded: max(0, rewarded), resetAt: resetAt)
    defaults.set(try? JSONEncoder().encode(wallet), forKey: walletKey)
    defaults.set(
      max(0, min(estimatedMinutesPerAvoidedOpen, 60)), forKey: estimatedMinutesPerAvoidedOpenKey)
    defaults.set(max(60, min(unlockDurationSeconds, 86_400)), forKey: unlockDurationSecondsKey)
    defaults.set(restrictionsEnabled, forKey: restrictionsEnabledKey)
    applyShields()
  }

  /// Spends one saved pass, the only way in without an ad now that emergency
  /// access is gone. Returns nil when there is none to spend.
  static func consumeAvailableUnlock() -> String? {
    guard restrictionsEnabled else { return nil }
    var wallet = loadWallet()
    guard wallet.rewarded > 0 else { return nil }
    wallet.rewarded -= 1
    defaults.set(try? JSONEncoder().encode(wallet), forKey: walletKey)
    return "rewarded"
  }

  static func refundUnlock(_ source: String) {
    guard source == "rewarded" else { return }
    var wallet = loadWallet()
    wallet.rewarded += 1
    defaults.set(try? JSONEncoder().encode(wallet), forKey: walletKey)
  }

  static func enqueueUnlock(_ event: NativeUnlockEvent) {
    var events = pendingUnlocks()
    events.removeAll { $0.clientSessionId == event.clientSessionId }
    events.append(event)
    defaults.set(try? JSONEncoder().encode(events), forKey: unlockOutboxKey)
  }

  static func pendingUnlocks() -> [NativeUnlockEvent] {
    guard let data = defaults.data(forKey: unlockOutboxKey),
      let events = try? JSONDecoder().decode([NativeUnlockEvent].self, from: data)
    else { return [] }
    return events
  }

  static func acknowledgeUnlock(_ clientSessionId: String) {
    let remaining = pendingUnlocks().filter { $0.clientSessionId != clientSessionId }
    defaults.set(try? JSONEncoder().encode(remaining), forKey: unlockOutboxKey)
  }

  static func recordIntervention(targetMetricScope: String, avoided: Bool, unlocked: Bool) {
    recordOpenAttempt(targetMetricScope: targetMetricScope)
    recordOutcome(targetMetricScope: targetMetricScope, avoided: avoided, unlocked: unlocked)
  }

  static func recordOpenAttempt(targetMetricScope: String) {
    recordOpenAttempt(at: "productMetrics:\(localDay())")
    recordOpenAttempt(at: targetMetricsKey(targetMetricScope))
  }

  static func recordOutcome(targetMetricScope: String, avoided: Bool, unlocked: Bool) {
    recordOutcome(at: "productMetrics:\(localDay())", avoided: avoided, unlocked: unlocked)
    recordOutcome(at: targetMetricsKey(targetMetricScope), avoided: avoided, unlocked: unlocked)
  }

  private static func recordOpenAttempt(at key: String) {
    var metrics: DailyProductMetrics
    if let data = defaults.data(forKey: key),
      let saved = try? JSONDecoder().decode(DailyProductMetrics.self, from: data)
    {
      metrics = saved
    } else {
      metrics = DailyProductMetrics()
    }
    metrics.openAttempts += 1
    defaults.set(try? JSONEncoder().encode(metrics), forKey: key)
  }

  private static func recordOutcome(at key: String, avoided: Bool, unlocked: Bool) {
    var metrics: DailyProductMetrics
    if let data = defaults.data(forKey: key),
      let saved = try? JSONDecoder().decode(DailyProductMetrics.self, from: data)
    {
      metrics = saved
    } else {
      metrics = DailyProductMetrics()
    }
    if avoided { metrics.avoidedOpens += 1 }
    if unlocked { metrics.unlocks += 1 }
    defaults.set(try? JSONEncoder().encode(metrics), forKey: key)
  }

  static func rollbackUnlockedIntervention(targetMetricScope: String) {
    rollbackUnlockedIntervention(at: "productMetrics:\(localDay())")
    rollbackUnlockedIntervention(at: targetMetricsKey(targetMetricScope))
  }

  private static func rollbackUnlockedIntervention(at key: String) {
    guard let data = defaults.data(forKey: key),
      var metrics = try? JSONDecoder().decode(DailyProductMetrics.self, from: data)
    else { return }
    metrics.openAttempts = max(0, metrics.openAttempts - 1)
    metrics.unlocks = max(0, metrics.unlocks - 1)
    defaults.set(try? JSONEncoder().encode(metrics), forKey: key)
  }

  // Shield actions run in a short-lived extension process. Flush App Group
  // writes before returning the action response so the main app cannot restore
  // a stale wallet before it sees the native outbox event.
  static func flush() {
    defaults.synchronize()
  }

  static func productMetrics() -> DailyProductMetrics {
    productMetrics(day: localDay())
  }

  /// One day's counters; `day` is `yyyy-MM-dd` as written by `localDay()`.
  static func productMetrics(day: String) -> DailyProductMetrics {
    guard let data = defaults.data(forKey: "productMetrics:\(day)"),
      let metrics = try? JSONDecoder().decode(DailyProductMetrics.self, from: data)
    else { return DailyProductMetrics() }
    return metrics
  }

  static func productMetrics(targetMetricScope: String) -> DailyProductMetrics {
    let key = targetMetricsKey(targetMetricScope)
    guard let data = defaults.data(forKey: key),
      let metrics = try? JSONDecoder().decode(DailyProductMetrics.self, from: data)
    else { return DailyProductMetrics() }
    return metrics
  }

  private static func loadWallet() -> LocalWallet {
    guard let data = defaults.data(forKey: walletKey),
      let wallet = try? JSONDecoder().decode(LocalWallet.self, from: data)
      // Corrupt or missing shared state must never mint access. The JS layer
      // synchronizes the server-owned wallet before enabling shields.
    else {
      return LocalWallet(rewarded: 0, resetAt: Date().addingTimeInterval(86_400))
    }
    return wallet
  }

  private static func loadSessions() -> [String: UnlockRecord] {
    guard let data = defaults.data(forKey: sessionsKey),
      let sessions = try? JSONDecoder().decode([String: UnlockRecord].self, from: data)
    else { return [:] }
    return sessions
  }

  private static func saveSessions(_ sessions: [String: UnlockRecord]) {
    defaults.set(try? JSONEncoder().encode(sessions), forKey: sessionsKey)
  }

  private static func pruneExpiredSessions() {
    let uptime = ProcessInfo.processInfo.systemUptime
    let epoch = bootEpoch()
    let active = loadSessions().filter { _, record in
      abs(record.bootEpoch - epoch) < 60 && record.deadlineUptime > uptime
    }
    saveSessions(active)
  }

  private static func targetMetricsKey(_ scope: String) -> String {
    "\(targetProductMetricsPrefix)\(scope):\(localDay())"
  }

  private static var externalBrowserBypassActive: Bool {
    guard let deadline = defaults.object(forKey: externalBrowserBypassUntilKey) as? Date else {
      return false
    }
    return deadline > Date()
  }

  private static func bootEpoch() -> TimeInterval {
    Date().timeIntervalSince1970 - ProcessInfo.processInfo.systemUptime
  }
  /// The phone's own calendar day, so "today" starts at local midnight (not
  /// at UTC midnight, which is 21:00 in Uruguay). Mirrors Android's StillDay.
  private static func localDay(_ date: Date = Date()) -> String {
    let formatter = DateFormatter()
    formatter.calendar = Calendar(identifier: .gregorian)
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.timeZone = TimeZone.current
    formatter.dateFormat = "yyyy-MM-dd"
    return formatter.string(from: date)
  }

  /// The last `count` local days as `yyyy-MM-dd`, oldest first, ending today.
  static func lastLocalDays(_ count: Int) -> [String] {
    let calendar = Calendar.current
    let today = calendar.startOfDay(for: Date())
    return (0..<count).reversed().map { offset in
      localDay(calendar.date(byAdding: .day, value: -offset, to: today) ?? today)
    }
  }
  private static func tokenKey<T: Encodable>(_ token: T) -> String {
    ((try? JSONEncoder().encode(token)) ?? Data()).base64EncodedString()
  }
}
