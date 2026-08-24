import ManagedSettings
import ManagedSettingsUI
import UIKit

final class ShieldConfigurationExtension: ShieldConfigurationDataSource {
  private struct LocalWallet: Codable {
    let rewarded: Int
    let emergency: Int
    let resetAt: Date
  }

  private let appGroup = "group.com.still.screentime"
  private let walletKey = "localWallet"
  private let ink = UIColor(red: 45/255, green: 46/255, blue: 49/255, alpha: 1)
  private let forest = UIColor(red: 52/255, green: 66/255, blue: 55/255, alpha: 1)
  private let linen = UIColor(red: 246/255, green: 244/255, blue: 241/255, alpha: 1)
  private var isSpanish: Bool { Locale.preferredLanguages.first?.hasPrefix("es") == true }
  private func copy(_ english: String, _ spanish: String) -> String { isSpanish ? spanish : english }

  private var hasAvailableUnlock: Bool {
    guard
      let defaults = UserDefaults(suiteName: appGroup),
      let data = defaults.data(forKey: walletKey),
      let wallet = try? JSONDecoder().decode(LocalWallet.self, from: data)
    else {
      return false
    }
    return wallet.rewarded > 0
  }

  override func configuration(shielding application: Application) -> ShieldConfiguration {
    let canUnlock = hasAvailableUnlock
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
        text: canUnlock
          ? copy("Do you really want to open this app?", "¿Realmente quieres abrir esta app?")
          : copy("Open Still to earn another token.", "Abre Still para conseguir otro token."),
        color: ink
      ),
      primaryButtonLabel: .init(text: copy("Not now", "Ahora no"), color: .white),
      primaryButtonBackgroundColor: forest,
      secondaryButtonLabel: .init(
        text: canUnlock
          ? copy("Use 1 Unlock Token", "Usar 1 Unlock Token")
          : copy("Close and recharge in Still", "Cerrar y recargar en Still"),
        color: ink
      )
    )
  }

  override func configuration(shielding application: Application, in category: ActivityCategory) -> ShieldConfiguration {
    configuration(shielding: application)
  }
}
