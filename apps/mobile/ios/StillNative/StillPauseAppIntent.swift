import AppIntents
import Foundation

/// An app Still can pause, as Shortcuts shows it. The identifier is the app's
/// display name, which is what the pause itself works with, so an automation
/// keeps resolving even after "Delete local data" wiped the mirrored list.
@available(iOS 16.4, *)
struct StillAppEntity: AppEntity {
  static let typeDisplayRepresentation = TypeDisplayRepresentation(name: "App")
  static let defaultQuery = StillAppQuery()

  let id: String

  var displayRepresentation: DisplayRepresentation {
    DisplayRepresentation(title: "\(id)")
  }

  init?(named rawName: String) {
    let name = rawName.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !name.isEmpty, name.count <= 80, !ShortcutTargetStore.isReserved(name) else {
      return nil
    }
    // "Twitter" resolves to the catalog's "X", so both share one action.
    id = ShortcutTargetStore.find(appName: name)?.name ?? name
  }
}

/// The apps chosen in Still. They are the options of the action's App
/// parameter and, through `StillAppShortcuts`, one ready-made action each.
@available(iOS 16.4, *)
struct StillAppQuery: EntityStringQuery {
  func entities(for identifiers: [String]) async throws -> [StillAppEntity] {
    identifiers.compactMap(StillAppEntity.init(named:))
  }

  /// Typing in the picker searches the chosen apps and the catalog; any other
  /// name is accepted as typed and adopted the first time it runs.
  func entities(matching string: String) async throws -> [StillAppEntity] {
    let key = ShortcutTargetStore.normalize(string)
    guard !key.isEmpty else { return try await suggestedEntities() }
    let known = ShortcutTargetStore.load()
      .filter { $0.state != "removed" && $0.matchKeys.contains { $0.hasPrefix(key) } }
      .sorted { ($0.state == "active" ? 0 : 1) < ($1.state == "active" ? 0 : 1) }
      .compactMap { StillAppEntity(named: $0.name) }
    if known.contains(where: { ShortcutTargetStore.normalize($0.id) == key }) {
      return known
    }
    return known + [StillAppEntity(named: string)].compactMap { $0 }
  }

  func suggestedEntities() async throws -> [StillAppEntity] {
    ShortcutTargetStore.load()
      .filter { $0.state == "active" }
      .compactMap { StillAppEntity(named: $0.name) }
  }
}

/// Still's action, one sec style: added to an "App is opened" automation with
/// the app already set, so nothing has to be picked, typed or wired with
/// variables. `PauseBeforeOpeningIntent` stays for automations made before it.
@available(iOS 16.4, *)
struct PauseAppIntent: AppIntent {
  static let title: LocalizedStringResource = "Pause App"
  static let description = IntentDescription(
    "Shows Still's pause before the app opens. Add it to an automation that runs when that app is opened."
  )
  static let openAppWhenRun = false

  @Parameter(title: "App", description: "The app Still pauses before it opens.")
  var app: StillAppEntity

  static var parameterSummary: some ParameterSummary {
    Summary("Pause \(\.$app)")
  }

  @available(iOS 26.0, *)
  static var supportedModes: IntentModes {
    [.background, .foreground(.dynamic)]
  }

  init() {}

  init(app: StillAppEntity) {
    self.app = app
  }

  func perform() async throws -> some IntentResult {
    try await pauseBeforeOpening(appName: app.id)
    return .result()
  }
}

@available(iOS 16.4, *)
extension PauseAppIntent: ForegroundContinuableIntent {}

/// One "Pause <App>" per app chosen in Still, listed under Still in Shortcuts'
/// action search. `ShortcutTargetStore.replace` refreshes them.
@available(iOS 17.0, *)
struct StillAppShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: PauseAppIntent(),
      phrases: ["Pause \(\.$app) with \(.applicationName)"],
      shortTitle: "Pause App",
      systemImageName: "pause.circle"
    )
  }

  static let shortcutTileColor: ShortcutTileColor = .grayBlue
}
