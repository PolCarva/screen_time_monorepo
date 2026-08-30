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
  private let unlockDurationSecondsKey = "unlockDurationSeconds"
  private let graphite = UIColor(red: 36/255, green: 40/255, blue: 38/255, alpha: 1)
  private let graphiteSoft = UIColor(red: 78/255, green: 84/255, blue: 81/255, alpha: 1)
  private let chalk = UIColor(red: 241/255, green: 239/255, blue: 232/255, alpha: 1)
  private let mineralLight = UIColor(red: 167/255, green: 181/255, blue: 186/255, alpha: 1)
  private let mineral = UIColor(red: 105/255, green: 127/255, blue: 140/255, alpha: 1)
  private let peach = UIColor(red: 211/255, green: 154/255, blue: 131/255, alpha: 1)
  private var isSpanish: Bool { Locale.preferredLanguages.first?.hasPrefix("es") == true }
  private func copy(_ english: String, _ spanish: String) -> String { isSpanish ? spanish : english }
  private var unlockDurationMinutes: Int {
    guard let defaults = UserDefaults(suiteName: appGroup) else { return 10 }
    let seconds = defaults.integer(forKey: unlockDurationSecondsKey)
    return max(1, Int(round(Double(seconds > 0 ? seconds : 600) / 60)))
  }

  private var todayKey: String {
    let formatter = DateFormatter()
    formatter.calendar = Calendar(identifier: .gregorian)
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.timeZone = TimeZone(secondsFromGMT: 0)
    formatter.dateFormat = "yyyy-MM-dd"
    return productMetricsPrefix + formatter.string(from: Date())
  }

  private var todayMetrics: LocalProductMetrics {
    guard let defaults = UserDefaults(suiteName: appGroup),
          let data = defaults.data(forKey: todayKey),
          let metrics = try? JSONDecoder().decode(LocalProductMetrics.self, from: data)
    else { return .init(openAttempts: 0, avoidedOpens: 0, unlocks: 0) }
    return metrics
  }

  private var impactSummary: String {
    let avoidedOpens = lifetimeAvoidedOpens
    let estimatedMinutes = Double(avoidedOpens) * estimatedMinutesPerAvoidedOpen
    let duration = formatSavedTime(minutes: estimatedMinutes)
    return avoidedOpens == 1
      ? copy("1 automatic open avoided · \(duration) returned (est.)", "1 apertura automática evitada · \(duration) recuperados (est.)")
      : copy("\(avoidedOpens) automatic opens avoided · \(duration) returned (est.)", "\(avoidedOpens) aperturas automáticas evitadas · \(duration) recuperados (est.)")
  }

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
    else { return 0 }
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

  private enum AvailableUnlock { case rewarded, emergency, none }
  private var availableUnlock: AvailableUnlock {
    guard let defaults = UserDefaults(suiteName: appGroup),
          let data = defaults.data(forKey: walletKey),
          let wallet = try? JSONDecoder().decode(LocalWallet.self, from: data)
    else { return .none }
    if wallet.rewarded > 0 { return .rewarded }
    if wallet.emergency > 0 { return .emergency }
    return .none
  }

  private func fieldIcon() -> UIImage {
    let size = CGSize(width: 64, height: 64)
    return UIGraphicsImageRenderer(size: size).image { _ in
      let module = CGSize(width: 24, height: 10)
      let xLeft: CGFloat = 5
      let xRight: CGFloat = 35
      let rows: [CGFloat] = [8, 27, 46]
      for (index, y) in rows.enumerated() {
        let leftOffset: CGFloat = index == 1 ? -3 : 0
        let rightOffset: CGFloat = index == 1 ? 3 : 0
        (index == 1 ? mineral : chalk).setFill()
        UIBezierPath(roundedRect: CGRect(x: xLeft + leftOffset, y: y, width: module.width, height: module.height), cornerRadius: 2).fill()
        (index == 1 ? peach : chalk).setFill()
        UIBezierPath(roundedRect: CGRect(x: xRight + rightOffset, y: y, width: module.width, height: module.height), cornerRadius: 2).fill()
      }
    }
  }

  override func configuration(shielding application: Application) -> ShieldConfiguration {
    let unlock = availableUnlock
    let canUnlock: Bool
    let secondaryButtonText: String
    switch unlock {
    case .rewarded:
      canUnlock = true
      secondaryButtonText = copy("Use 1 pass · \(unlockDurationMinutes) min", "Usar 1 pase · \(unlockDurationMinutes) min")
    case .emergency:
      canUnlock = true
      secondaryButtonText = copy("Emergency access · \(unlockDurationMinutes) min", "Acceso de emergencia · \(unlockDurationMinutes) min")
    case .none:
      canUnlock = false
      secondaryButtonText = copy("Open Still to get a pass", "Abrir Still para conseguir un pase")
    }
    let appName = application.localizedDisplayName ?? copy("Selected app", "App seleccionada")
    let attempt = todayMetrics.openAttempts + 1
    let observedFact = attempt == 1
      ? copy("\(appName) opened once today.", "\(appName) se abrió una vez hoy.")
      : copy("\(appName) opened \(attempt) times today.", "\(appName) se abrió \(attempt) veces hoy.")

    return ShieldConfiguration(
      backgroundBlurStyle: .none,
      backgroundColor: graphite,
      icon: fieldIcon(),
      title: .init(text: observedFact, color: chalk),
      subtitle: .init(
        text: copy("What do you want from the next \(unlockDurationMinutes) minutes?", "¿Qué quieres de los próximos \(unlockDurationMinutes) minutos?") + "\n\n" + impactSummary,
        color: mineralLight
      ),
      primaryButtonLabel: .init(text: copy("Go back", "Volver"), color: graphite),
      primaryButtonBackgroundColor: chalk,
      secondaryButtonLabel: .init(text: secondaryButtonText, color: canUnlock ? chalk : mineralLight)
    )
  }

  override func configuration(shielding application: Application, in category: ActivityCategory) -> ShieldConfiguration {
    configuration(shielding: application)
  }
}
