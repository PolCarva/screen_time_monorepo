import Foundation
import ManagedSettings
import UserNotifications

final class ShieldActionExtension: ShieldActionDelegate {
  private var shouldScheduleMonitoring: Bool {
    #if targetEnvironment(simulator)
      false
    #else
      true
    #endif
  }

  override func handle(
    action: ShieldAction,
    for application: ApplicationToken,
    completionHandler: @escaping (ShieldActionResponse) -> Void
  ) {
    handle(action: action, beginUnlock: {
      try SharedRestrictionState.beginUnlock(application: application, durationSeconds: 600, scheduleMonitoring: shouldScheduleMonitoring)
    }, onUnavailable: {
      SharedRestrictionState.savePendingTarget(application)
    }, completionHandler: completionHandler)
  }

  override func handle(
    action: ShieldAction,
    for category: ActivityCategoryToken,
    completionHandler: @escaping (ShieldActionResponse) -> Void
  ) {
    handle(action: action, beginUnlock: {
      try SharedRestrictionState.beginUnlock(category: category, durationSeconds: 600, scheduleMonitoring: shouldScheduleMonitoring)
    }, completionHandler: completionHandler)
  }

  override func handle(
    action: ShieldAction,
    for webDomain: WebDomainToken,
    completionHandler: @escaping (ShieldActionResponse) -> Void
  ) {
    handle(action: action, beginUnlock: {
      try SharedRestrictionState.beginUnlock(webDomain: webDomain, durationSeconds: 600, scheduleMonitoring: shouldScheduleMonitoring)
    }, completionHandler: completionHandler)
  }

  private func handle(
    action: ShieldAction,
    beginUnlock: () throws -> (String, Date),
    onUnavailable: () -> Void = {},
    completionHandler: @escaping (ShieldActionResponse) -> Void
  ) {
    guard action == .secondaryButtonPressed else {
      SharedRestrictionState.recordIntervention(avoided: true, unlocked: false)
      SharedRestrictionState.flush()
      completionHandler(.close)
      return
    }

    guard let source = SharedRestrictionState.consumeRewardedUnlock() else {
      SharedRestrictionState.recordIntervention(avoided: false, unlocked: false)
      SharedRestrictionState.markRechargeRequested()
      onUnavailable()
      SharedRestrictionState.flush()
      openStillForRecharge()
      scheduleRechargeNotification()
      completionHandler(.close)
      return
    }

    let clientSessionId = UUID().uuidString
    let startedAt = Date()
    SharedRestrictionState.enqueueUnlock(.init(
      clientSessionId: clientSessionId,
      source: source,
      durationSeconds: 600,
      startedAt: startedAt
    ))
    SharedRestrictionState.recordIntervention(avoided: false, unlocked: true)
    SharedRestrictionState.flush()

    do {
      _ = try beginUnlock()
      // Removing the active Shield may terminate this short-lived extension.
      // Do it only after the spend and outbox are durable.
      SharedRestrictionState.applyShields()
      SharedRestrictionState.flush()
      completionHandler(.none)
    } catch {
      SharedRestrictionState.acknowledgeUnlock(clientSessionId)
      SharedRestrictionState.refundUnlock(source)
      SharedRestrictionState.rollbackUnlockedIntervention()
      SharedRestrictionState.recordIntervention(avoided: false, unlocked: false)
      onUnavailable()
      SharedRestrictionState.flush()
      completionHandler(.defer)
    }
  }

  private func openStillForRecharge() {
    guard let url = URL(string: "still://recharge") else { return }
    NSExtensionContext().open(url, completionHandler: nil)
  }

  private func scheduleRechargeNotification() {
    let content = UNMutableNotificationContent()
    let spanish = Locale.preferredLanguages.first?.hasPrefix("es") == true
    content.title = spanish ? "Still está listo para recargar" : "Still is ready to recharge"
    content.body = spanish
      ? "Abre Still para ver un anuncio y conseguir otro Unlock Token."
      : "Open Still to watch an ad and earn another Unlock Token."
    content.sound = .default
    content.userInfo = ["route": "tokens"]
    let request = UNNotificationRequest(
      identifier: "still.recharge",
      content: content,
      trigger: nil
    )
    UNUserNotificationCenter.current().add(request, withCompletionHandler: nil)
  }
}
