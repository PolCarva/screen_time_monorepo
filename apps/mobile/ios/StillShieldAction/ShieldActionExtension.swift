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
    }, onUnavailable: {
      SharedRestrictionState.savePendingTarget(category)
    }, completionHandler: completionHandler)
  }

  override func handle(
    action: ShieldAction,
    for webDomain: WebDomainToken,
    completionHandler: @escaping (ShieldActionResponse) -> Void
  ) {
    handle(action: action, beginUnlock: {
      try SharedRestrictionState.beginUnlock(webDomain: webDomain, durationSeconds: 600, scheduleMonitoring: shouldScheduleMonitoring)
    }, onUnavailable: {
      SharedRestrictionState.savePendingTarget(webDomain)
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

    guard let source = SharedRestrictionState.consumeAvailableUnlock() else {
      SharedRestrictionState.recordIntervention(avoided: false, unlocked: false)
      let requestId = SharedRestrictionState.markRechargeRequested()
      onUnavailable()
      SharedRestrictionState.flush()
      finishRechargeRequest(requestId: requestId, completionHandler)
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

  private func finishRechargeRequest(
    requestId: String,
    _ completionHandler: @escaping (ShieldActionResponse) -> Void
  ) {
    #if compiler(>=6.3)
      if #available(iOS 26.5, *) {
        completionHandler(.openParentalControlsApp)
        return
      }
    #endif

    scheduleRechargeNotification(requestId: requestId)
    completionHandler(.close)
  }

  private func scheduleRechargeNotification(requestId: String) {
    let content = UNMutableNotificationContent()
    let spanish = Locale.preferredLanguages.first?.hasPrefix("es") == true
    content.title = spanish
      ? "Still está listo para recargar"
      : "Still is ready to recharge"
    content.body = spanish
      ? "Mirá un anuncio y Still desbloqueará la app que querías abrir."
      : "Watch an ad and Still will unlock the app you were trying to open."
    content.sound = .default
    content.userInfo = [
      "route": "tokens",
      "autoUnlock": true,
      "requestId": requestId,
    ]

    let request = UNNotificationRequest(
      identifier: "still.recharge",
      content: content,
      trigger: nil
    )
    UNUserNotificationCenter.current().add(request, withCompletionHandler: nil)
  }
}
