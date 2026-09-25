import AppIntents
import Foundation
import UserNotifications

struct ShortcutInterventionContext: Codable {
  let id: String
  let appName: String
  let returnShortcutName: String
  let targetKey: String
  let attemptsToday: Int
  let createdAt: Date
  // Optional so a context persisted by an older build still decodes.
  var isSetupTest: Bool?
}

struct ShortcutTarget: Codable {
  let id: String
  var name: String
  var matchKeys: [String]
  var urlScheme: String?
  var origin: String
  var state: String
}

/// Mirror of the apps chosen in Still plus whatever the automation taught the
/// intent. JavaScript owns the selection; this store only adopts apps it has
/// never seen and records when each one last fired.
enum ShortcutTargetStore {
  private static let targetsKey = "shortcutIntervention.targets"
  private static let lastTriggeredKey = "shortcutIntervention.lastTriggered"
  private static let firstTriggeredKey = "shortcutIntervention.firstTriggered"
  private static let setupProbeKey = "shortcutIntervention.setupProbe"
  private static let probeLifetime: TimeInterval = 120
  private static let states: Set<String> = ["active", "available", "removed"]
  private static let origins: Set<String> = ["catalog", "custom", "detected"]
  private static let blockedSchemes: Set<String> = [
    "still", "shortcuts", "http", "https", "tel", "sms", "mailto", "file", "javascript",
  ]

  // Still itself and Apple's Shortcuts app are never paused: "Current App"
  // reports Shortcuts when a shortcut is run by hand. Mirrored in
  // src/lib/shortcut-targets.ts.
  private static let reservedKeys: Set<String> = [
    "still", "stilldevelopment", "stillpreview", "shortcuts", "atajos",
  ]

  static func isReserved(_ name: String) -> Bool { reservedKeys.contains(normalize(name)) }

  private struct SetupProbe: Codable {
    let targetKey: String
    let startedAt: Date
  }

  /// Must stay identical to `normalizeAppName` in src/lib/ios-app-catalog.ts.
  static func normalize(_ name: String) -> String {
    let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
    var folded = String.UnicodeScalarView()
    for scalar in trimmed.decomposedStringWithCanonicalMapping.unicodeScalars
    where !(0x0300...0x036F).contains(scalar.value) {
      folded.append(scalar)
    }
    var ascii = String.UnicodeScalarView()
    for scalar in String(folded).lowercased().unicodeScalars
    where (97...122).contains(scalar.value) || (48...57).contains(scalar.value) {
      ascii.append(scalar)
    }
    let key = String(ascii)
    return key.isEmpty ? trimmed.lowercased() : key
  }

  static func load() -> [ShortcutTarget] {
    guard let data = SharedRestrictionState.defaults.data(forKey: targetsKey),
      let targets = try? JSONDecoder().decode([ShortcutTarget].self, from: data)
    else { return [] }
    return targets
  }

  private static func save(_ targets: [ShortcutTarget]) {
    SharedRestrictionState.defaults.set(try? JSONEncoder().encode(targets), forKey: targetsKey)
  }

  static func replace(with incoming: [ShortcutTarget]) {
    var merged = incoming.compactMap(sanitize)
    let incomingIds = Set(merged.map(\.id))
    var survivors: [ShortcutTarget] = []
    // Apps adopted while JavaScript was not running must not be lost, and an
    // app JavaScript already covers inherits the adoption instead of doubling.
    for adopted in load() where adopted.origin == "detected" && !incomingIds.contains(adopted.id) {
      if let index = merged.firstIndex(where: {
        !Set($0.matchKeys).isDisjoint(with: adopted.matchKeys)
      }) {
        if adopted.state == "active", merged[index].state == "available" {
          merged[index].state = "active"
        }
      } else {
        survivors.append(adopted)
      }
    }
    save(merged + survivors)
    SharedRestrictionState.flush()
    // Shortcuts lists a ready-made "Pause <App>" action for each chosen app.
    if #available(iOS 17.0, *) { StillAppShortcuts.updateAppShortcutParameters() }
  }

  static func find(appName: String) -> ShortcutTarget? {
    let key = normalize(appName)
    return load().first { $0.matchKeys.contains(key) }
  }

  /// Returns the target for a name coming from Shortcuts, adopting it when the
  /// user added the app to the automation without choosing it in Still.
  static func resolve(appName: String) -> ShortcutTarget {
    let key = normalize(appName)
    var targets = load()
    if let index = targets.firstIndex(where: { $0.matchKeys.contains(key) }) {
      if targets[index].state == "available" {
        targets[index].state = "active"
        save(targets)
      }
      return targets[index]
    }
    let adopted = ShortcutTarget(
      id: "detected:\(key)", name: appName, matchKeys: [key], urlScheme: nil,
      origin: "detected", state: "active")
    targets.append(adopted)
    save(targets)
    return adopted
  }

  static func markTriggered(_ targetKey: String) {
    let now = Date()
    var last = loadDates(lastTriggeredKey)
    last[targetKey] = now
    saveDates(last, forKey: lastTriggeredKey)
    var first = loadDates(firstTriggeredKey)
    if first[targetKey] == nil {
      first[targetKey] = now
      saveDates(first, forKey: firstTriggeredKey)
    }
  }

  static func lastTriggered(_ targetKey: String) -> Date? { loadDates(lastTriggeredKey)[targetKey] }
  static func firstTriggered(_ targetKey: String) -> Date? {
    loadDates(firstTriggeredKey)[targetKey]
  }

  static func beginSetupProbe(appName: String) {
    let canonical = find(appName: appName)?.name ?? appName
    let probe = SetupProbe(
      targetKey: ShortcutInterventionState.key(appName: canonical), startedAt: Date())
    SharedRestrictionState.defaults.set(try? JSONEncoder().encode(probe), forKey: setupProbeKey)
    SharedRestrictionState.flush()
  }

  /// True exactly once, when the automation fires for the app being tested.
  static func consumeSetupProbe(for targetKey: String) -> Bool {
    guard let data = SharedRestrictionState.defaults.data(forKey: setupProbeKey),
      let probe = try? JSONDecoder().decode(SetupProbe.self, from: data)
    else { return false }
    guard probe.startedAt.addingTimeInterval(probeLifetime) > Date() else {
      SharedRestrictionState.defaults.removeObject(forKey: setupProbeKey)
      return false
    }
    guard probe.targetKey == targetKey else { return false }
    SharedRestrictionState.defaults.removeObject(forKey: setupProbeKey)
    return true
  }

  static func validatedScheme(_ candidate: String?) -> String? {
    guard let candidate, let url = URL(string: candidate), let scheme = url.scheme?.lowercased(),
      !blockedSchemes.contains(scheme),
      scheme.range(of: "^[a-z][a-z0-9+.-]*$", options: .regularExpression) != nil,
      // Only a bare `scheme://` may be stored, so no path or query can ride along.
      candidate == "\(scheme)://"
    else { return nil }
    return candidate
  }

  private static func sanitize(_ target: ShortcutTarget) -> ShortcutTarget? {
    let name = target.name.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !target.id.isEmpty, target.id.count <= 120, !name.isEmpty, name.count <= 80,
      !isReserved(name),
      states.contains(target.state), origins.contains(target.origin)
    else { return nil }
    let keys = target.matchKeys.filter { !$0.isEmpty && $0.count <= 80 }
    return ShortcutTarget(
      id: target.id, name: name, matchKeys: keys.isEmpty ? [normalize(name)] : keys,
      urlScheme: validatedScheme(target.urlScheme), origin: target.origin, state: target.state)
  }

  private static func loadDates(_ key: String) -> [String: Date] {
    guard let data = SharedRestrictionState.defaults.data(forKey: key),
      let dates = try? JSONDecoder().decode([String: Date].self, from: data)
    else { return [:] }
    return dates
  }

  private static func saveDates(_ dates: [String: Date], forKey key: String) {
    SharedRestrictionState.defaults.set(try? JSONEncoder().encode(dates), forKey: key)
  }
}

/// The last counted pause of each app, to tell a real skip from one undone
/// right after (docs/real-savings-estimate-plan.md §2.3, D6): a pause that did
/// not end in the app, followed within ten minutes by going into that same
/// app, gives no time back. Mirrors Android's ReentryTrail.kt.
enum PauseTrailStore {
  struct Trail: Codable {
    let at: Date
    var entered: Bool
    let followsSkip: Bool
  }

  static let window: TimeInterval = 10 * 60
  private static let trailsKey = "shortcutIntervention.pauseTrail"

  /// A new counted pause of `targetKey`.
  static func recordPause(_ targetKey: String, at now: Date = Date()) {
    var trails = load()
    let previous = trails[targetKey]
    let elapsed = previous.map { now.timeIntervalSince($0.at) } ?? -1
    trails[targetKey] = Trail(
      at: now,
      entered: false,
      followsSkip: previous.map { !$0.entered } == true && elapsed >= 0 && elapsed <= window
    )
    save(trails)
  }

  /// The user goes into `targetKey` from its last pause; true when that entry
  /// undoes a skipped pause (one re-entry).
  static func recordEntry(_ targetKey: String) -> Bool {
    var trails = load()
    guard var trail = trails[targetKey], !trail.entered else { return false }
    trail.entered = true
    trails[targetKey] = trail
    save(trails)
    return trail.followsSkip
  }

  private static func load() -> [String: Trail] {
    guard let data = SharedRestrictionState.defaults.data(forKey: trailsKey),
      let trails = try? JSONDecoder().decode([String: Trail].self, from: data)
    else { return [:] }
    return trails
  }

  private static func save(_ trails: [String: Trail]) {
    SharedRestrictionState.defaults.set(try? JSONEncoder().encode(trails), forKey: trailsKey)
  }
}

enum ShortcutInterventionState {
  private static let pendingKey = "shortcutIntervention.pending"
  private static let allowancesKey = "shortcutIntervention.allowances"
  private static let contextLifetime: TimeInterval = 10 * 60
  // Typed by the user in Shortcuts: keep it to characters on the stock iOS
  // keyboard. Must match `returnShortcutName` in src/lib/shortcut-targets.ts.
  private static let returnShortcutPrefix = "Still - "

  static func prepare(appName: String) throws -> ShortcutInterventionContext? {
    let requestedName = appName.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !requestedName.isEmpty, requestedName.count <= 80 else {
      throw ShortcutInterventionError.invalidAppName
    }

    SharedRestrictionState.setShortcutModeEnabled(true)
    guard !ShortcutTargetStore.isReserved(requestedName) else { return nil }
    // "Twitter" and "X" are one app. Resolving first gives every alias the
    // same allowance, the same counter and the same way back.
    let target = ShortcutTargetStore.resolve(appName: requestedName)
    let cleanAppName = target.name
    let returnShortcutName = "\(returnShortcutPrefix)\(cleanAppName)"
    // The allowance and counter belong to the app, not to the helper shortcut.
    // Renaming or rebuilding the return shortcut must not reset that app's history.
    let targetKey = key(appName: cleanAppName)
    // Every run proves the automation is alive, including the silent ones.
    ShortcutTargetStore.markTriggered(targetKey)
    // `restrictionsEnabled` mirrors the remote iOS kill switch. While it is off
    // the automation keeps firing but Still never interrupts.
    guard SharedRestrictionState.restrictionsEnabled, target.state != "removed" else {
      SharedRestrictionState.flush()
      return nil
    }

    let metricScope = "shortcut:\(targetKey)"
    if ShortcutTargetStore.consumeSetupProbe(for: targetKey) {
      // A setup test is not an open attempt and must work during an allowance.
      let context = ShortcutInterventionContext(
        id: UUID().uuidString,
        appName: cleanAppName,
        returnShortcutName: returnShortcutName,
        targetKey: targetKey,
        attemptsToday: SharedRestrictionState.productMetrics(targetMetricScope: metricScope)
          .openAttempts,
        createdAt: Date(),
        isSetupTest: true
      )
      savePending(context)
      SharedRestrictionState.flush()
      return context
    }

    guard !hasActiveAllowance(for: targetKey) else {
      SharedRestrictionState.flush()
      return nil
    }

    if let existing = pending(),
      existing.targetKey == targetKey,
      existing.isSetupTest != true,
      existing.createdAt.addingTimeInterval(30) > Date()
    {
      return existing
    }

    SharedRestrictionState.recordOpenAttempt(targetMetricScope: metricScope)
    PauseTrailStore.recordPause(targetKey)
    let context = ShortcutInterventionContext(
      id: UUID().uuidString,
      appName: cleanAppName,
      returnShortcutName: returnShortcutName,
      targetKey: targetKey,
      attemptsToday: SharedRestrictionState.productMetrics(targetMetricScope: metricScope)
        .openAttempts,
      createdAt: Date()
    )
    savePending(context)
    SharedRestrictionState.flush()
    return context
  }

  static func pending() -> ShortcutInterventionContext? {
    guard let data = SharedRestrictionState.defaults.data(forKey: pendingKey),
      let context = try? JSONDecoder().decode(ShortcutInterventionContext.self, from: data)
    else { return nil }
    guard context.createdAt.addingTimeInterval(contextLifetime) > Date() else {
      SharedRestrictionState.defaults.removeObject(forKey: pendingKey)
      SharedRestrictionState.flush()
      return nil
    }
    return context
  }

  /// Returns the session id, the allowance end, the way back to the app and,
  /// when that way is a URL scheme, the return shortcut to try if it fails.
  static func complete(id: String, durationSeconds: Int) throws -> (String, Date, URL, URL?) {
    guard let context = pending(), context.id == id, context.isSetupTest != true else {
      throw ShortcutInterventionError.missingContext
    }
    let duration = max(60, min(durationSeconds, 86_400))
    let end = Date().addingTimeInterval(TimeInterval(duration))
    var allowances = loadAllowances()
    allowances[context.targetKey] = end
    saveAllowances(allowances)
    // The allowance is a deadline, never a countdown that staying in the app
    // can extend: from `end` on, the automation pauses the app again. iOS has
    // no way to close an app that is already in front, so the exact second is
    // announced instead.
    SharedRestrictionState.scheduleWindowEndNotification(
      key: context.targetKey, appName: context.appName, at: end)
    SharedRestrictionState.defaults.removeObject(forKey: pendingKey)
    SharedRestrictionState.recordOutcome(
      targetMetricScope: "shortcut:\(context.targetKey)",
      avoided: false,
      unlocked: true
    )
    if PauseTrailStore.recordEntry(context.targetKey) {
      SharedRestrictionState.recordReentry(targetMetricScope: "shortcut:\(context.targetKey)")
    }
    SharedRestrictionState.flush()
    let shortcutURL = try returnURL(shortcutName: context.returnShortcutName)
    if let scheme = ShortcutTargetStore.find(appName: context.appName)?.urlScheme,
      let direct = URL(string: scheme)
    {
      return (UUID().uuidString, end, direct, shortcutURL)
    }
    return (UUID().uuidString, end, shortcutURL, nil)
  }

  static func returnKind(for context: ShortcutInterventionContext) -> String {
    ShortcutTargetStore.find(appName: context.appName)?.urlScheme == nil ? "shortcut" : "scheme"
  }

  /// Closes a setup test without touching the app's counters.
  static func finishSetupTest(id: String) {
    guard let context = pending(), context.id == id, context.isSetupTest == true else { return }
    SharedRestrictionState.defaults.removeObject(forKey: pendingKey)
    SharedRestrictionState.flush()
  }

  static func cancel(id: String) throws {
    guard let context = pending(), context.id == id else {
      throw ShortcutInterventionError.missingContext
    }
    SharedRestrictionState.defaults.removeObject(forKey: pendingKey)
    guard context.isSetupTest != true else {
      SharedRestrictionState.flush()
      return
    }
    SharedRestrictionState.recordOutcome(
      targetMetricScope: "shortcut:\(context.targetKey)",
      avoided: true,
      unlocked: false
    )
    SharedRestrictionState.flush()
  }

  private static func hasActiveAllowance(for targetKey: String) -> Bool {
    var allowances = loadAllowances()
    let now = Date()
    let expired = allowances.filter { $0.value <= now }.keys
    allowances = allowances.filter { $0.value > now }
    saveAllowances(allowances)
    for key in expired { SharedRestrictionState.cancelWindowEndNotification(key: key) }
    return allowances[targetKey] != nil
  }

  /// Allowances still running, newest deadline per app. Read by React Native so
  /// Still can show what is open and for how much longer.
  static func activeAllowances() -> [(targetKey: String, endsAt: Date)] {
    let now = Date()
    return loadAllowances()
      .filter { $0.value > now }
      .map { (targetKey: $0.key, endsAt: $0.value) }
      .sorted { $0.endsAt < $1.endsAt }
  }

  private static func loadAllowances() -> [String: Date] {
    guard let data = SharedRestrictionState.defaults.data(forKey: allowancesKey),
      let allowances = try? JSONDecoder().decode([String: Date].self, from: data)
    else { return [:] }
    return allowances
  }

  private static func saveAllowances(_ allowances: [String: Date]) {
    SharedRestrictionState.defaults.set(
      try? JSONEncoder().encode(allowances), forKey: allowancesKey)
  }

  private static func savePending(_ context: ShortcutInterventionContext) {
    SharedRestrictionState.defaults.set(try? JSONEncoder().encode(context), forKey: pendingKey)
  }

  static func key(appName: String) -> String {
    Data(appName.lowercased().utf8).base64EncodedString()
  }

  private static func returnURL(shortcutName: String) throws -> URL {
    var components = URLComponents()
    components.scheme = "shortcuts"
    components.host = "run-shortcut"
    components.queryItems = [URLQueryItem(name: "name", value: shortcutName)]
    guard let url = components.url else {
      throw ShortcutInterventionError.invalidReturnShortcut
    }
    return url
  }
}

enum ShortcutInterventionError: Error, CustomLocalizedStringResourceConvertible {
  case invalidAppName
  case invalidReturnShortcut
  case missingContext

  var localizedStringResource: LocalizedStringResource {
    switch self {
    case .invalidAppName:
      "Enter the name of the app you want Still to pause."
    case .invalidReturnShortcut:
      "Create the app-opening shortcut with the name shown by Still."
    case .missingContext:
      "This pause expired. Open the app again to retry."
    }
  }
}

/// Lets the Shortcuts action offer the apps chosen in Still instead of asking
/// the user to type a name. A variable such as "Current App" is still accepted.
@available(iOS 16.4, *)
struct ShortcutTargetOptionsProvider: DynamicOptionsProvider {
  func results() async throws -> [String] {
    let targets = ShortcutTargetStore.load()
    let chosen = targets.filter { $0.state == "active" }.map(\.name)
    // Before anything is chosen in Still, offer the catalog rather than an empty list.
    return chosen.isEmpty ? targets.filter { $0.state == "available" }.map(\.name) : chosen
  }
}

/// The first version of Still's action, where the app was picked or passed as
/// a variable. `PauseAppIntent` replaces it; this one stays so automations
/// made with it keep working, hidden from the action list so nobody adds it.
@available(iOS 16.4, *)
struct PauseBeforeOpeningIntent: AppIntent {
  static let title: LocalizedStringResource = "Pause Before Opening"
  static let description = IntentDescription(
    "Shows a Still pause when an app-opening personal automation runs."
  )
  static let openAppWhenRun = false
  static let isDiscoverable = false

  @Parameter(
    title: "App name",
    description: "The name Still should show, for example Instagram.",
    optionsProvider: ShortcutTargetOptionsProvider()
  )
  var appName: String

  static var parameterSummary: some ParameterSummary {
    Summary("Pause before opening \(\.$appName)")
  }

  @available(iOS 26.0, *)
  static var supportedModes: IntentModes {
    [.background, .foreground(.dynamic)]
  }

  func perform() async throws -> some IntentResult {
    try await pauseBeforeOpening(appName: appName)
    return .result()
  }
}

@available(iOS 16.4, *)
extension PauseBeforeOpeningIntent: ForegroundContinuableIntent {}

@available(iOS 16.4, *)
extension ForegroundContinuableIntent {
  /// What every Still pause action does: decide in the background and bring
  /// Still to the front only when the app should really be paused.
  func pauseBeforeOpening(appName: String) async throws {
    guard try ShortcutInterventionState.prepare(appName: appName) != nil else { return }
    if #available(iOS 26.0, *) {
      try await continueInForeground(alwaysConfirm: false)
    } else {
      try await requestToContinueInForeground(
        IntentDialog("Continue in Still to decide whether to open the app.")
      )
    }
  }
}
