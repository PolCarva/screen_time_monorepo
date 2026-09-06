import AppIntents
import Foundation

struct ShortcutInterventionContext: Codable {
  let id: String
  let appName: String
  let returnShortcutName: String
  let targetKey: String
  let attemptsToday: Int
  let createdAt: Date
}

enum ShortcutInterventionState {
  private static let pendingKey = "shortcutIntervention.pending"
  private static let allowancesKey = "shortcutIntervention.allowances"
  private static let contextLifetime: TimeInterval = 10 * 60
  private static let returnShortcutPrefix = "Still · "

  static func prepare(appName: String) throws -> ShortcutInterventionContext? {
    let cleanAppName = appName.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !cleanAppName.isEmpty, cleanAppName.count <= 80 else {
      throw ShortcutInterventionError.invalidAppName
    }
    let returnShortcutName = "\(returnShortcutPrefix)\(cleanAppName)"

    SharedRestrictionState.setShortcutModeEnabled(true)
    // The allowance and counter belong to the app, not to the helper shortcut.
    // Renaming or rebuilding the return shortcut must not reset that app's history.
    let targetKey = key(appName: cleanAppName)
    guard !hasActiveAllowance(for: targetKey) else { return nil }

    if let existing = pending(),
      existing.targetKey == targetKey,
      existing.createdAt.addingTimeInterval(30) > Date()
    {
      return existing
    }

    let metricScope = "shortcut:\(targetKey)"
    SharedRestrictionState.recordOpenAttempt(targetMetricScope: metricScope)
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

  static func complete(id: String, durationSeconds: Int) throws -> (String, Date, URL) {
    guard let context = pending(), context.id == id else {
      throw ShortcutInterventionError.missingContext
    }
    let duration = max(60, min(durationSeconds, 86_400))
    let end = Date().addingTimeInterval(TimeInterval(duration))
    var allowances = loadAllowances()
    allowances[context.targetKey] = end
    saveAllowances(allowances)
    SharedRestrictionState.defaults.removeObject(forKey: pendingKey)
    SharedRestrictionState.recordOutcome(
      targetMetricScope: "shortcut:\(context.targetKey)",
      avoided: false,
      unlocked: true
    )
    SharedRestrictionState.flush()
    return (UUID().uuidString, end, try returnURL(shortcutName: context.returnShortcutName))
  }

  static func cancel(id: String) throws {
    guard let context = pending(), context.id == id else {
      throw ShortcutInterventionError.missingContext
    }
    SharedRestrictionState.defaults.removeObject(forKey: pendingKey)
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
    allowances = allowances.filter { $0.value > now }
    saveAllowances(allowances)
    return allowances[targetKey] != nil
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

  private static func key(appName: String) -> String {
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

@available(iOS 16.4, *)
struct PauseBeforeOpeningIntent: AppIntent {
  static let title: LocalizedStringResource = "Pause Before Opening"
  static let description = IntentDescription(
    "Shows a Still pause when an app-opening personal automation runs."
  )
  static let openAppWhenRun = false

  @Parameter(
    title: "App name",
    description: "The name Still should show, for example YouTube."
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
    guard
      try ShortcutInterventionState.prepare(appName: appName) != nil
    else {
      return .result()
    }

    if #available(iOS 26.0, *) {
      try await continueInForeground(alwaysConfirm: false)
    } else {
      try await requestToContinueInForeground(
        IntentDialog("Continue in Still to decide whether to open the app.")
      )
    }
    return .result()
  }
}

@available(iOS 16.4, *)
extension PauseBeforeOpeningIntent: ForegroundContinuableIntent {}
