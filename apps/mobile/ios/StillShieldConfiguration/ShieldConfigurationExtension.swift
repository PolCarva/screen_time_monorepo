import ManagedSettings
import ManagedSettingsUI
import UIKit

final class ShieldConfigurationExtension: ShieldConfigurationDataSource {
  private let ink = UIColor(red: 45/255, green: 46/255, blue: 49/255, alpha: 1)
  private let forest = UIColor(red: 52/255, green: 66/255, blue: 55/255, alpha: 1)
  private let linen = UIColor(red: 246/255, green: 244/255, blue: 241/255, alpha: 1)
  private var isSpanish: Bool { Locale.preferredLanguages.first?.hasPrefix("es") == true }
  private func copy(_ english: String, _ spanish: String) -> String { isSpanish ? spanish : english }

  override func configuration(shielding application: Application) -> ShieldConfiguration {
    ShieldConfiguration(
      backgroundBlurStyle: .systemMaterialLight,
      backgroundColor: linen,
      icon: UIImage(systemName: "leaf"),
      title: .init(text: copy("A pause before you enter", "Una pausa antes de entrar"), color: forest),
      subtitle: .init(text: copy("Do you really want to open this app?", "¿Realmente quieres abrir esta app?"), color: ink),
      primaryButtonLabel: .init(text: copy("Not now", "Ahora no"), color: .white),
      primaryButtonBackgroundColor: forest,
      secondaryButtonLabel: .init(text: copy("Use 1 Unlock Token", "Usar 1 Unlock Token"), color: ink)
    )
  }

  override func configuration(shielding application: Application, in category: ActivityCategory) -> ShieldConfiguration {
    configuration(shielding: application)
  }
}
