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

  @objc func requestWellbeingAuthorization(
    _ resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    resolve("authorized")
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
      resolve([
        "id": result.0,
        "endsAt": ISO8601DateFormatter().string(from: result.1),
        "returnUrl": result.2.absoluteString,
      ])
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
      let shortcutHealth: [String: Any] = [
        "authorization": "authorized",
        "engineActive": true,
        "selectedCount": 0,
        "mode": "shortcuts",
      ]
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

  @objc func getLocalWellbeing(
    _ resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    let metrics = SharedRestrictionState.productMetrics()
    resolve([
      "controlledScreenTimeSeconds": 0,
      "openAttempts": metrics.openAttempts,
      "avoidedOpens": metrics.avoidedOpens,
      "unlocks": metrics.unlocks,
      "weeklyScreenTimeSeconds": [],
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
