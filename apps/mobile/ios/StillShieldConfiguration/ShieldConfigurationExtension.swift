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
  private let ink = UIColor(red: 23/255, green: 24/255, blue: 20/255, alpha: 1)
  private let paper = UIColor(red: 243/255, green: 240/255, blue: 232/255, alpha: 1)
  private let signal = UIColor(red: 255/255, green: 92/255, blue: 53/255, alpha: 1)
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
      secondaryButtonText = copy("Use 1 pass · 10 min", "Usar 1 pase · 10 min")
    case .emergency:
      canUnlock = true
      secondaryButtonText = copy("Use emergency pass · 10 min", "Usar pase de emergencia · 10 min")
    case .none:
      canUnlock = false
      secondaryButtonText = copy("Open Still to get a pass", "Abrir Still para conseguir un pase")
    }
    return ShieldConfiguration(
      backgroundBlurStyle: .none,
      backgroundColor: paper,
      icon: UIImage(systemName: "pause"),
      title: .init(
        text: canUnlock
          ? copy("A pause before entering", "Una pausa antes de entrar")
          : copy("No passes available", "No hay pases disponibles"),
        color: ink
      ),
      subtitle: .init(
        text: (canUnlock
          ? copy("One choice. Nothing else.", "Una decisión. Nada más.")
          : copy("Close this pause or open Still to get another pass.", "Cierra esta pausa o abre Still para conseguir otro pase."))
          + "\n\n" + impactSummary,
        color: ink
      ),
      primaryButtonLabel: .init(text: copy("Don't enter", "No entrar"), color: ink),
      primaryButtonBackgroundColor: signal,
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
