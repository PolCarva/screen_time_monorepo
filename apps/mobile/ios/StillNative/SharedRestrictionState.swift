import DeviceActivity
import FamilyControls
import Foundation
import ManagedSettings

enum SharedRestrictionState {
  static let appGroup = "group.com.still.screentime"
  static let defaults = UserDefaults(suiteName: appGroup)!
  static let store = ManagedSettingsStore(named: .init("still.restrictions"))
  private static let selectionKey = "familyActivitySelection"
  private static let sessionsKey = "unlockSessions"
  private static let pendingTargetKey = "pendingApplicationToken"
  private static let pendingRechargeKey = "pendingRechargeRequest"
  private static let walletKey = "localWallet"
  private static let unlockOutboxKey = "nativeUnlockOutbox"

  struct UnlockRecord: Codable {
    let tokenKey: String
    let targetKind: String?
    let deadlineUptime: TimeInterval
    let bootEpoch: TimeInterval
  }

  struct LocalWallet: Codable {
    var rewarded: Int
    var emergency: Int
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
    pruneExpiredSessions()
    let sessions = loadSessions().values
    let activeApplications = Set(sessions.filter { $0.targetKind == nil || $0.targetKind == "application" }.map(\.tokenKey))
    let activeCategories = Set(sessions.filter { $0.targetKind == "category" }.map(\.tokenKey))
    let activeWebDomains = Set(sessions.filter { $0.targetKind == "webDomain" }.map(\.tokenKey))
    let chosen = selection
    store.shield.applications = Set(chosen.applicationTokens.filter { !activeApplications.contains(tokenKey($0)) })
    let shieldedCategories = Set(chosen.categoryTokens.filter { !activeCategories.contains(tokenKey($0)) })
    store.shield.applicationCategories = shieldedCategories.isEmpty ? nil : .specific(shieldedCategories)
    store.shield.webDomains = Set(chosen.webDomainTokens.filter { !activeWebDomains.contains(tokenKey($0)) })
  }

  static func beginUnlock(application token: ApplicationToken, durationSeconds: Int, scheduleMonitoring: Bool = true) throws -> (String, Date) {
    try beginUnlock(targetKind: "application", tokenKey: tokenKey(token), durationSeconds: durationSeconds, scheduleMonitoring: scheduleMonitoring)
  }

  static func beginUnlock(category token: ActivityCategoryToken, durationSeconds: Int, scheduleMonitoring: Bool = true) throws -> (String, Date) {
    try beginUnlock(targetKind: "category", tokenKey: tokenKey(token), durationSeconds: durationSeconds, scheduleMonitoring: scheduleMonitoring)
  }

  static func beginUnlock(webDomain token: WebDomainToken, durationSeconds: Int, scheduleMonitoring: Bool = true) throws -> (String, Date) {
    try beginUnlock(targetKind: "webDomain", tokenKey: tokenKey(token), durationSeconds: durationSeconds, scheduleMonitoring: scheduleMonitoring)
  }

  private static func beginUnlock(targetKind: String, tokenKey: String, durationSeconds: Int, scheduleMonitoring: Bool) throws -> (String, Date) {
    let duration = max(60, min(durationSeconds, 3_600))
    let id = UUID().uuidString
    let deadline = ProcessInfo.processInfo.systemUptime + TimeInterval(duration)
    var sessions = loadSessions()
    sessions[id] = UnlockRecord(tokenKey: tokenKey, targetKind: targetKind, deadlineUptime: deadline, bootEpoch: bootEpoch())
    saveSessions(sessions)

    let now = Date()
    let end = now.addingTimeInterval(TimeInterval(duration))
    if scheduleMonitoring {
      let calendar = Calendar.current
      let schedule = DeviceActivitySchedule(
        intervalStart: calendar.dateComponents([.hour, .minute, .second], from: now),
        intervalEnd: calendar.dateComponents([.hour, .minute, .second], from: end),
        repeats: false
      )
      try DeviceActivityCenter().startMonitoring(.init("still.unlock.\(id)"), during: schedule)
    }
    return (id, end)
  }

  static func restore(sessionId: String) {
    var sessions = loadSessions()
    sessions.removeValue(forKey: sessionId)
    saveSessions(sessions)
    defaults.set(ISO8601DateFormatter().string(from: Date()), forKey: "lastRestoredAt")
    applyShields()
  }

  static func restoreExpired() {
    pruneExpiredSessions()
    applyShields()
  }

  static func savePendingTarget(_ token: ApplicationToken) {
    defaults.set(try? JSONEncoder().encode(token), forKey: pendingTargetKey)
  }

  static func takePendingTarget() -> ApplicationToken? {
    defer { defaults.removeObject(forKey: pendingTargetKey) }
    guard let data = defaults.data(forKey: pendingTargetKey) else { return nil }
    return try? JSONDecoder().decode(ApplicationToken.self, from: data)
  }

  static var hasPendingTarget: Bool { defaults.data(forKey: pendingTargetKey) != nil }

  static func markRechargeRequested() {
    defaults.set(true, forKey: pendingRechargeKey)
  }

  static func takePendingRechargeRequest() -> Bool {
    let requested = defaults.bool(forKey: pendingRechargeKey)
    defaults.removeObject(forKey: pendingRechargeKey)
    return requested
  }

  static func syncWallet(rewarded: Int, emergency: Int, resetAt: Date) {
    let wallet = LocalWallet(rewarded: max(0, rewarded), emergency: max(0, emergency), resetAt: resetAt)
    defaults.set(try? JSONEncoder().encode(wallet), forKey: walletKey)
  }

  static func consumeUnlock() -> String? {
    var wallet = loadWallet()
    if wallet.resetAt <= Date() {
      wallet.emergency = 3
      wallet.resetAt = Calendar(identifier: .gregorian).date(byAdding: .day, value: 1, to: Date()) ?? Date().addingTimeInterval(86_400)
    }
    let source: String
    if wallet.rewarded > 0 { wallet.rewarded -= 1; source = "rewarded" }
    else if wallet.emergency > 0 { wallet.emergency -= 1; source = "emergency" }
    else { return nil }
    defaults.set(try? JSONEncoder().encode(wallet), forKey: walletKey)
    return source
  }

  static func refundUnlock(_ source: String) {
    var wallet = loadWallet()
    if source == "rewarded" { wallet.rewarded += 1 }
    else if source == "emergency" { wallet.emergency += 1 }
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

  static func recordIntervention(avoided: Bool, unlocked: Bool) {
    let key = "productMetrics:\(utcDay())"
    var metrics: DailyProductMetrics
    if let data = defaults.data(forKey: key), let saved = try? JSONDecoder().decode(DailyProductMetrics.self, from: data) {
      metrics = saved
    } else {
      metrics = DailyProductMetrics()
    }
    metrics.openAttempts += 1
    if avoided { metrics.avoidedOpens += 1 }
    if unlocked { metrics.unlocks += 1 }
    defaults.set(try? JSONEncoder().encode(metrics), forKey: key)
  }

  static func rollbackUnlockedIntervention() {
    let key = "productMetrics:\(utcDay())"
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
    let key = "productMetrics:\(utcDay())"
    guard let data = defaults.data(forKey: key),
          let metrics = try? JSONDecoder().decode(DailyProductMetrics.self, from: data)
    else { return DailyProductMetrics() }
    return metrics
  }

  private static func loadWallet() -> LocalWallet {
    guard let data = defaults.data(forKey: walletKey), let wallet = try? JSONDecoder().decode(LocalWallet.self, from: data)
    else { return LocalWallet(rewarded: 0, emergency: 3, resetAt: Date().addingTimeInterval(86_400)) }
    return wallet
  }

  private static func loadSessions() -> [String: UnlockRecord] {
    guard let data = defaults.data(forKey: sessionsKey), let sessions = try? JSONDecoder().decode([String: UnlockRecord].self, from: data)
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

  private static func bootEpoch() -> TimeInterval { Date().timeIntervalSince1970 - ProcessInfo.processInfo.systemUptime }
  private static func utcDay() -> String {
    let formatter = DateFormatter()
    formatter.calendar = Calendar(identifier: .gregorian)
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.timeZone = TimeZone(secondsFromGMT: 0)
    formatter.dateFormat = "yyyy-MM-dd"
    return formatter.string(from: Date())
  }
  private static func tokenKey<T: Encodable>(_ token: T) -> String {
    ((try? JSONEncoder().encode(token)) ?? Data()).base64EncodedString()
  }
}
