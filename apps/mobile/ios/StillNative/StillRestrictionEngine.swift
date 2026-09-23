import FamilyControls
import Foundation
import React
import SwiftUI
import UIKit

@objc(StillRestrictionEngine)
final class StillRestrictionEngine: RCTEventEmitter {
  private var shouldScheduleMonitoring: Bool {
    #if targetEnvironment(simulator)
      false
    #else
      true
    #endif
  }

  override static func requiresMainQueueSetup() -> Bool { true }
  override func supportedEvents() -> [String]! { ["onInterventionRequested"] }

  @objc func requestAuthorization(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    Task { @MainActor in
      do {
        try await AuthorizationCenter.shared.requestAuthorization(for: .individual)
        resolve("authorized")
      } catch {
        reject("family_controls_authorization", error.localizedDescription, error)
      }
    }
  }

  @objc func presentAppPicker(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.main.async {
      guard let presenter = RCTPresentedViewController() else {
        reject("no_presenter", "No view controller can present the app picker", nil)
        return
      }
      let sheet = StillFamilyPicker(initial: SharedRestrictionState.selection) { selection in
        SharedRestrictionState.selection = selection
        resolve([
          "count": selection.applicationTokens.count + selection.categoryTokens.count
            + selection.webDomainTokens.count,
          "localReference": "ios-app-group-selection",
        ])
        presenter.dismiss(animated: true)
      }
      presenter.present(UIHostingController(rootView: sheet), animated: true)
    }
  }

  @objc func beginExternalAuthSession(
    _ resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    do {
      try SharedRestrictionState.beginExternalBrowserBypass(
        scheduleMonitoring: shouldScheduleMonitoring
      )
      resolve(nil)
    } catch {
      reject("external_browser_bypass_failed", error.localizedDescription, error)
    }
  }

  @objc func endExternalAuthSession(
    _ resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    SharedRestrictionState.endExternalBrowserBypass()
    resolve(nil)
  }

  @objc func applyRestrictions(
    _ selection: NSDictionary,
    resolver resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    SharedRestrictionState.applyShields()
    resolve(nil)
  }

  @objc func enableShortcutMode(
    _ resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    SharedRestrictionState.setShortcutModeEnabled(true)
    resolve(nil)
  }

  @objc func getPendingShortcutIntervention(
    _ resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    guard let context = ShortcutInterventionState.pending() else {
      resolve(nil)
      return
    }
    resolve([
      "id": context.id,
      "appName": context.appName,
      "returnShortcutName": context.returnShortcutName,
      "attemptsToday": context.attemptsToday,
      "createdAt": ISO8601DateFormatter().string(from: context.createdAt),
      "isSetupTest": context.isSetupTest == true,
      "returnKind": ShortcutInterventionState.returnKind(for: context),
    ])
  }

  @objc func completeShortcutIntervention(
    _ contextId: String,
    durationSeconds: NSNumber,
    resolver resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    do {
      let result = try ShortcutInterventionState.complete(
        id: contextId,
        durationSeconds: durationSeconds.intValue
      )
      var session: [String: Any] = [
        "id": result.0,
        "endsAt": ISO8601DateFormatter().string(from: result.1),
        "returnUrl": result.2.absoluteString,
      ]
      if let fallback = result.3 { session["fallbackReturnUrl"] = fallback.absoluteString }
      resolve(session)
    } catch {
      reject("shortcut_intervention_expired", error.localizedDescription, error)
    }
  }

  @objc func cancelShortcutIntervention(
    _ contextId: String,
    resolver resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    do {
      try ShortcutInterventionState.cancel(id: contextId)
      resolve(nil)
    } catch {
      reject("shortcut_intervention_expired", error.localizedDescription, error)
    }
  }

  @objc func finishShortcutSetupTest(
    _ contextId: String,
    resolver resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    ShortcutInterventionState.finishSetupTest(id: contextId)
    resolve(nil)
  }

  @objc func setShortcutTargets(
    _ targets: NSArray,
    resolver resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    let parsed: [ShortcutTarget] = targets.compactMap { entry in
      guard let value = entry as? NSDictionary,
        let id = value["id"] as? String,
        let name = value["name"] as? String,
        let origin = value["origin"] as? String,
        let state = value["state"] as? String
      else { return nil }
      return ShortcutTarget(
        id: id, name: name, matchKeys: value["matchKeys"] as? [String] ?? [],
        urlScheme: value["urlScheme"] as? String, origin: origin, state: state)
    }
    ShortcutTargetStore.replace(with: parsed)
    resolve(nil)
  }

  @objc func getShortcutTargetsHealth(
    _ resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    let formatter = ISO8601DateFormatter()
    let health: [[String: Any]] = ShortcutTargetStore.load().map { target in
      let targetKey = ShortcutInterventionState.key(appName: target.name)
      var entry: [String: Any] = [
        "id": target.id,
        "name": target.name,
        "matchKeys": target.matchKeys,
        "origin": target.origin,
        "state": target.state,
        "targetKey": targetKey,
      ]
      entry["urlScheme"] = target.urlScheme ?? NSNull()
      if let last = ShortcutTargetStore.lastTriggered(targetKey) {
        entry["lastTriggeredAt"] = formatter.string(from: last)
      }
      if let first = ShortcutTargetStore.firstTriggered(targetKey) {
        entry["verifiedAt"] = formatter.string(from: first)
      }
      return entry
    }
    resolve(health)
  }

  @objc func beginShortcutSetupProbe(
    _ appName: String,
    resolver resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    ShortcutTargetStore.beginSetupProbe(appName: appName)
    resolve(nil)
  }

  /// Sends Still to the background so the user lands on the Home Screen after
  /// declining to open an app. iOS has no public API for this; `suspend` is the
  /// same message the system sends for a Home press. JavaScript only calls it
  /// while the remote `iosHomeOnCancelEnabled` flag is on and falls back to a
  /// helper shortcut or a manual hint otherwise.
  @objc func suspendToHome(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.main.async {
      let application = UIApplication.shared
      let selector = NSSelectorFromString("suspend")
      guard application.responds(to: selector) else {
        reject("suspend_unavailable", "This iOS version cannot leave to the Home Screen", nil)
        return
      }
      application.perform(selector)
      resolve(nil)
    }
  }

  @objc func startUnlock(
    _ target: NSDictionary,
    durationSeconds: NSNumber,
    resolver resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    guard let target = SharedRestrictionState.pendingTarget() else {
      reject("missing_target", "No shielded application is waiting", nil)
      return
    }
    do {
      let result: (String, Date)
      switch target {
      case .application(let token):
        result = try SharedRestrictionState.beginUnlock(
          application: token,
          durationSeconds: durationSeconds.intValue,
          scheduleMonitoring: shouldScheduleMonitoring
        )
      case .category(let token):
        result = try SharedRestrictionState.beginUnlock(
          category: token,
          durationSeconds: durationSeconds.intValue,
          scheduleMonitoring: shouldScheduleMonitoring
        )
      case .webDomain(let token):
        result = try SharedRestrictionState.beginUnlock(
          webDomain: token,
          durationSeconds: durationSeconds.intValue,
          scheduleMonitoring: shouldScheduleMonitoring
        )
      }
      SharedRestrictionState.applyShields()
      SharedRestrictionState.clearPendingTarget()
      SharedRestrictionState.flush()
      resolve(["id": result.0, "endsAt": ISO8601DateFormatter().string(from: result.1)])
    } catch {
      reject("unlock_schedule_failed", error.localizedDescription, error)
    }
  }

  @objc func restoreRestriction(
    _ sessionId: String,
    resolver resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    SharedRestrictionState.restore(sessionId: sessionId)
    resolve(nil)
  }

  @objc func getHealth(
    _ resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    let selection = SharedRestrictionState.selection
    if SharedRestrictionState.shortcutModeEnabled {
      // iOS offers no way to ask whether a personal automation exists. An app
      // counts as connected only once its automation has actually fired.
      let chosen = ShortcutTargetStore.load().filter { $0.state == "active" }
      let verified = chosen.filter {
        ShortcutTargetStore.firstTriggered(ShortcutInterventionState.key(appName: $0.name)) != nil
      }
      var shortcutHealth: [String: Any] = [
        "authorization": "authorized",
        "engineActive": !verified.isEmpty,
        "selectedCount": chosen.count,
        "verifiedCount": verified.count,
        "mode": "shortcuts",
      ]
      if chosen.isEmpty {
        shortcutHealth["issue"] = "shortcuts_no_apps"
      } else if verified.isEmpty {
        shortcutHealth["issue"] = "shortcuts_not_verified"
      }
      resolve(shortcutHealth)
      return
    }
    let status: String
    switch AuthorizationCenter.shared.authorizationStatus {
    case .approved: status = "authorized"
    case .denied: status = "denied"
    case .notDetermined: status = "notDetermined"
    @unknown default: status = "unavailable"
    }
    let count =
      selection.applicationTokens.count + selection.categoryTokens.count
      + selection.webDomainTokens.count
    var health: [String: Any] = [
      "authorization": status,
      "engineActive": SharedRestrictionState.restrictionsEnabled && status == "authorized"
        && count > 0,
      "selectedCount": count,
      "mode": "managed",
    ]
    if let lastRestoredAt = SharedRestrictionState.defaults.string(forKey: "lastRestoredAt") {
      health["lastRestoredAt"] = lastRestoredAt
    }
    if !SharedRestrictionState.restrictionsEnabled { health["issue"] = "restrictions_disabled" }
    resolve(health)
  }

  @objc func syncWallet(
    _ rewarded: NSNumber,
    emergency: NSNumber,
    resetAt: String,
    estimatedMinutesPerAvoidedOpen: NSNumber,
    unlockDurationSeconds: NSNumber,
    restrictionsEnabled: NSNumber,
    resolver resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    let date = ISO8601DateFormatter().date(from: resetAt) ?? Date().addingTimeInterval(86_400)
    SharedRestrictionState.syncWallet(
      rewarded: rewarded.intValue,
      emergency: emergency.intValue,
      resetAt: date,
      estimatedMinutesPerAvoidedOpen: estimatedMinutesPerAvoidedOpen.doubleValue,
      unlockDurationSeconds: unlockDurationSeconds.intValue,
      restrictionsEnabled: restrictionsEnabled.boolValue
    )
    resolve(nil)
  }

  /// The windows running right now, newest deadline last. In Shortcut mode the
  /// app is known by the name the automation reported, so it can be named.
  @objc func getAccessWindows(
    _ resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    let formatter = ISO8601DateFormatter()
    guard SharedRestrictionState.shortcutModeEnabled else {
      resolve(
        SharedRestrictionState.activeWindowEnds().map { end in
          ["label": "", "endsAt": formatter.string(from: end)]
        })
      return
    }
    let names = Dictionary(
      ShortcutTargetStore.load().map {
        (ShortcutInterventionState.key(appName: $0.name), $0.name)
      },
      uniquingKeysWith: { first, _ in first })
    resolve(
      ShortcutInterventionState.activeAllowances().map { allowance in
        [
          "label": names[allowance.targetKey] ?? "",
          "endsAt": formatter.string(from: allowance.endsAt),
        ]
      })
  }

  @objc func getPendingUnlockEvents(
    _ resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    let formatter = ISO8601DateFormatter()
    resolve(
      SharedRestrictionState.pendingUnlocks().map { event in
        [
          "clientSessionId": event.clientSessionId,
          "source": event.source,
          "durationSeconds": event.durationSeconds,
          "startedAt": formatter.string(from: event.startedAt),
        ]
      })
  }

  @objc func acknowledgeUnlockEvent(
    _ clientSessionId: String,
    resolver resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    SharedRestrictionState.acknowledgeUnlock(clientSessionId)
    resolve(nil)
  }

  @objc func hasPendingIntervention(
    _ resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    if let requestId = SharedRestrictionState.pendingRechargeRequestId() {
      resolve(requestId)
    } else if SharedRestrictionState.hasPendingTarget {
      resolve("pending-target")
    } else {
      resolve(nil)
    }
  }

  /// Still's own counters: today plus the last seven local days for Today's
  /// week, identical in shape to Android so both show the same numbers.
  @objc func getLocalWellbeing(
    _ resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    let metrics = SharedRestrictionState.productMetrics()
    let history = SharedRestrictionState.lastLocalDays(7).map { day -> [String: Any] in
      let dayMetrics = SharedRestrictionState.productMetrics(day: day)
      return [
        "date": day,
        "openAttempts": dayMetrics.openAttempts,
        "avoidedOpens": dayMetrics.avoidedOpens,
        "unlocks": dayMetrics.unlocks,
      ]
    }
    resolve([
      "openAttempts": metrics.openAttempts,
      "avoidedOpens": metrics.avoidedOpens,
      "unlocks": metrics.unlocks,
      "history": history,
    ])
  }

  @objc func resetLocalData(
    _ resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    SharedRestrictionState.resetLocalData()
    resolve(nil)
  }
}

private struct StillFamilyPicker: View {
  @State private var selection: FamilyActivitySelection
  let onDone: (FamilyActivitySelection) -> Void

  init(initial: FamilyActivitySelection, onDone: @escaping (FamilyActivitySelection) -> Void) {
    _selection = State(initialValue: initial)
    self.onDone = onDone
  }

  var body: some View {
    NavigationStack {
      FamilyActivityPicker(
        headerText: "Choose the apps where you want a pause",
        footerText: "Your selection stays on this device.",
        selection: $selection
      )
      .navigationTitle("Your pauses")
      .toolbar {
        ToolbarItem(placement: .confirmationAction) {
          Button("Done") { onDone(selection) }
        }
      }
    }
  }
}
