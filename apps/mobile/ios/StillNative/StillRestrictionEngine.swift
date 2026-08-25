import FamilyControls
import Foundation
import React
import SwiftUI
import UIKit

@objc(StillRestrictionEngine)
final class StillRestrictionEngine: RCTEventEmitter {
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
          "count": selection.applicationTokens.count + selection.categoryTokens.count + selection.webDomainTokens.count,
          "localReference": "ios-app-group-selection"
        ])
        presenter.dismiss(animated: true)
      }
      presenter.present(UIHostingController(rootView: sheet), animated: true)
    }
  }

  @objc func applyRestrictions(
    _ selection: NSDictionary,
    resolver resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    SharedRestrictionState.applyShields()
    resolve(nil)
  }

  @objc func startUnlock(
    _ target: NSDictionary,
    durationSeconds: NSNumber,
    resolver resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    guard let target = SharedRestrictionState.takePendingTarget() else {
      reject("missing_target", "No shielded application is waiting", nil)
      return
    }
    do {
      let result: (String, Date)
      switch target {
      case .application(let token):
        result = try SharedRestrictionState.beginUnlock(application: token, durationSeconds: durationSeconds.intValue)
      case .category(let token):
        result = try SharedRestrictionState.beginUnlock(category: token, durationSeconds: durationSeconds.intValue)
      case .webDomain(let token):
        result = try SharedRestrictionState.beginUnlock(webDomain: token, durationSeconds: durationSeconds.intValue)
      }
      SharedRestrictionState.applyShields()
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
    let status: String
    switch AuthorizationCenter.shared.authorizationStatus {
    case .approved: status = "authorized"
    case .denied: status = "denied"
    case .notDetermined: status = "notDetermined"
    @unknown default: status = "unavailable"
    }
    let count = selection.applicationTokens.count + selection.categoryTokens.count + selection.webDomainTokens.count
    resolve([
      "authorization": status,
      "engineActive": status == "authorized" && count > 0,
      "selectedCount": count,
      "lastRestoredAt": SharedRestrictionState.defaults.string(forKey: "lastRestoredAt") as Any
    ])
  }

  @objc func syncWallet(
    _ rewarded: NSNumber,
    emergency: NSNumber,
    resetAt: String,
    resolver resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    let date = ISO8601DateFormatter().date(from: resetAt) ?? Date().addingTimeInterval(86_400)
    SharedRestrictionState.syncWallet(rewarded: rewarded.intValue, emergency: emergency.intValue, resetAt: date)
    resolve(nil)
  }

  @objc func getPendingUnlockEvents(
    _ resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    let formatter = ISO8601DateFormatter()
    resolve(SharedRestrictionState.pendingUnlocks().map { event in
      [
        "clientSessionId": event.clientSessionId,
        "source": event.source,
        "durationSeconds": event.durationSeconds,
        "startedAt": formatter.string(from: event.startedAt)
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
      "weeklyScreenTimeSeconds": []
    ])
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
