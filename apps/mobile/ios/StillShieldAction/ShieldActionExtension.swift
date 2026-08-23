import Foundation
import ManagedSettings

final class ShieldActionExtension: ShieldActionDelegate {
  override func handle(
    action: ShieldAction,
    for application: ApplicationToken,
    completionHandler: @escaping (ShieldActionResponse) -> Void
  ) {
    switch action {
    case .primaryButtonPressed:
      SharedRestrictionState.recordIntervention(avoided: true, unlocked: false)
      completionHandler(.close)
    case .secondaryButtonPressed:
      if let source = SharedRestrictionState.consumeUnlock() {
        do {
          let startedAt = Date()
          let session = try SharedRestrictionState.beginUnlock(application: application, durationSeconds: 600)
          SharedRestrictionState.enqueueUnlock(.init(
            clientSessionId: session.0,
            source: source,
            durationSeconds: 600,
            startedAt: startedAt
          ))
          SharedRestrictionState.recordIntervention(avoided: false, unlocked: true)
          completionHandler(.close)
        } catch {
          SharedRestrictionState.refundUnlock(source)
          SharedRestrictionState.recordIntervention(avoided: false, unlocked: false)
          SharedRestrictionState.savePendingTarget(application)
          completionHandler(.defer)
        }
      } else {
        SharedRestrictionState.recordIntervention(avoided: false, unlocked: false)
        SharedRestrictionState.savePendingTarget(application)
        completionHandler(.defer)
      }
    @unknown default:
      completionHandler(.close)
    }
  }
}
