import ManagedSettings
import ManagedSettingsUI
import UIKit

final class ShieldConfigurationExtension: ShieldConfigurationDataSource {
  private struct LocalWallet: Codable {
    let rewarded: Int
    let emergency: Int
    let resetAt: Date
  }

  private struct LocalProductMetrics: Codable {
    let openAttempts: Int
    let avoidedOpens: Int
    let unlocks: Int
  }

  private let appGroup = "group.com.still.screentime"
  private let walletKey = "localWallet"
  private let productMetricsPrefix = "productMetrics:"
  private let estimatedMinutesPerAvoidedOpenKey = "estimatedMinutesPerAvoidedOpen"
  private let ink = UIColor(red: 45/255, green: 46/255, blue: 49/255, alpha: 1)
  private let forest = UIColor(red: 52/255, green: 66/255, blue: 55/255, alpha: 1)
  private let linen = UIColor(red: 246/255, green: 244/255, blue: 241/255, alpha: 1)
  private var isSpanish: Bool { Locale.preferredLanguages.first?.hasPrefix("es") == true }
  private func copy(_ english: String, _ spanish: String) -> String { isSpanish ? spanish : english }

  private var impactSummary: String {
    let avoidedOpens = lifetimeAvoidedOpens
    let estimatedMinutes = Double(avoidedOpens) * estimatedMinutesPerAvoidedOpen
    let duration = formatSavedTime(minutes: estimatedMinutes)
    if avoidedOpens == 1 {
      return copy(
        "1 entry blocked · \(duration) saved (est.)",
        "1 entrada bloqueada · \(duration) de ahorro estimado"
      )
    }
    return copy(
      "\(avoidedOpens) entries blocked · \(duration) saved (est.)",
      "\(avoidedOpens) entradas bloqueadas · \(duration) de ahorro estimado"
    )
  }

  /// Aggregates every locally retained day into one device-wide total, with no
  /// application-level breakdown.
  private var lifetimeAvoidedOpens: Int {
    guard let defaults = UserDefaults(suiteName: appGroup) else { return 0 }
    return defaults.dictionaryRepresentation().reduce(into: 0) { total, entry in
      guard entry.key.hasPrefix(productMetricsPrefix),
            let data = entry.value as? Data,
            let metrics = try? JSONDecoder().decode(LocalProductMetrics.self, from: data)
      else { return }
      total += max(0, metrics.avoidedOpens)
    }
  }

  private var estimatedMinutesPerAvoidedOpen: Double {
    guard let defaults = UserDefaults(suiteName: appGroup),
          let stored = defaults.object(forKey: estimatedMinutesPerAvoidedOpenKey) as? NSNumber
    else { return 2 }
    return max(0, min(stored.doubleValue, 60))
  }

  private func formatSavedTime(minutes: Double) -> String {
    let value = minutes < 60 ? minutes : minutes / 60
    let formatter = NumberFormatter()
    formatter.locale = Locale.current
    formatter.minimumFractionDigits = 0
    formatter.maximumFractionDigits = 1
    let formatted = formatter.string(from: NSNumber(value: value)) ?? String(Int(value.rounded()))
    return minutes < 60 ? "\(formatted) min" : "\(formatted) h"
  }

  private enum AvailableUnlock {
    case rewarded
    case emergency
    case none
  }

  private var availableUnlock: AvailableUnlock {
    guard
      let defaults = UserDefaults(suiteName: appGroup),
      let data = defaults.data(forKey: walletKey),
      let wallet = try? JSONDecoder().decode(LocalWallet.self, from: data)
    else {
      return .none
    }
    if wallet.rewarded > 0 { return .rewarded }
    if wallet.emergency > 0 { return .emergency }
    return .none
  }

  override func configuration(shielding application: Application) -> ShieldConfiguration {
    let unlock = availableUnlock
    let canUnlock: Bool
    let secondaryButtonText: String
    switch unlock {
    case .rewarded:
      canUnlock = true
      secondaryButtonText = copy("Use 1 Unlock Token", "Usar 1 Unlock Token")
    case .emergency:
      canUnlock = true
      secondaryButtonText = copy("Use 1 Emergency Unlock", "Usar 1 desbloqueo de emergencia")
    case .none:
      canUnlock = false
      secondaryButtonText = copy("Close and recharge in Still", "Cerrar y recargar en Still")
    }
    return ShieldConfiguration(
      backgroundBlurStyle: .systemMaterialLight,
      backgroundColor: linen,
      icon: UIImage(systemName: "leaf"),
      title: .init(
        text: canUnlock
          ? copy("A pause before you enter", "Una pausa antes de entrar")
          : copy("No Unlock Tokens left", "No te quedan Unlock Tokens"),
        color: forest
      ),
      subtitle: .init(
        text: (canUnlock
          ? copy("Do you really want to open this app?", "¿Realmente quieres abrir esta app?")
          : copy("Open Still to earn another token.", "Abre Still para conseguir otro token."))
          + "\n\n" + impactSummary,
        color: ink
      ),
      primaryButtonLabel: .init(text: copy("Not now", "Ahora no"), color: .white),
      primaryButtonBackgroundColor: forest,
      secondaryButtonLabel: .init(
        text: secondaryButtonText,
        color: ink
      )
    )
  }

  override func configuration(shielding application: Application, in category: ActivityCategory) -> ShieldConfiguration {
    configuration(shielding: application)
  }
}
