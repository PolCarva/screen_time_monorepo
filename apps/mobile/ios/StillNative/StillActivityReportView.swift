import DeviceActivity
import React
import SwiftUI
import UIKit
import _DeviceActivity_SwiftUI

@objc(StillActivityReportView)
final class StillActivityReportView: UIView {
  private var host: UIHostingController<DeviceActivityReport>?
  @objc var reportContext = "still.daily" { didSet { mountReport() } }

  override init(frame: CGRect) {
    super.init(frame: frame)
    mountReport()
  }

  required init?(coder: NSCoder) {
    super.init(coder: coder)
    mountReport()
  }

  private func mountReport() {
    host?.view.removeFromSuperview()
    let now = Date()
    let today = Calendar.current.startOfDay(for: now)
    let start = reportContext == "still.weekly"
      ? (Calendar.current.date(byAdding: .day, value: -6, to: today) ?? today)
      : today
    let interval = DateInterval(start: start, end: now)
    let filter = DeviceActivityFilter(segment: .daily(during: interval), devices: .all)
    let report = DeviceActivityReport(.init(reportContext), filter: filter)
    let controller = UIHostingController(rootView: report)
    controller.view.backgroundColor = .clear
    controller.view.translatesAutoresizingMaskIntoConstraints = false
    addSubview(controller.view)
    NSLayoutConstraint.activate([
      controller.view.leadingAnchor.constraint(equalTo: leadingAnchor),
      controller.view.trailingAnchor.constraint(equalTo: trailingAnchor),
      controller.view.topAnchor.constraint(equalTo: topAnchor),
      controller.view.bottomAnchor.constraint(equalTo: bottomAnchor),
    ])
    host = controller
  }
}

@objc(StillActivityReportViewManager)
final class StillActivityReportViewManager: RCTViewManager {
  override static func requiresMainQueueSetup() -> Bool { true }
  override func view() -> UIView! { StillActivityReportView() }
}
