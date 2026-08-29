import DeviceActivity
import ExtensionKit
import SwiftUI
import _DeviceActivity_SwiftUI

struct DailyReportConfiguration {
  let totalSeconds: TimeInterval
  let pickups: Int
}

struct DailyReportScene: DeviceActivityReportScene {
  let context: DeviceActivityReport.Context = .init("still.daily")
  let content: (DailyReportConfiguration) -> DailyReportView

  func makeConfiguration(
    representing data: DeviceActivityResults<DeviceActivityData>
  ) async -> DailyReportConfiguration {
    var seconds: TimeInterval = 0
    var pickups = 0
    for await deviceData in data {
      for await segment in deviceData.activitySegments {
        seconds += segment.totalActivityDuration
        pickups += segment.totalPickupsWithoutApplicationActivity
      }
    }
    return .init(totalSeconds: seconds, pickups: pickups)
  }
}

struct DailyReportView: View {
  let configuration: DailyReportConfiguration
  private var isSpanish: Bool { Locale.preferredLanguages.first?.hasPrefix("es") == true }

  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      Text(isSpanish ? "TIEMPO EN PANTALLA" : "SCREEN TIME")
        .font(.system(size: 11, weight: .semibold, design: .monospaced))
        .tracking(1.2)
        .foregroundStyle(Color(red: 93/255, green: 94/255, blue: 88/255))
      Text(Duration.seconds(configuration.totalSeconds).formatted(.time(pattern: .hourMinute)))
        .font(.system(size: 42, weight: .semibold, design: .monospaced))
        .tracking(-2)
        .foregroundStyle(Color(red: 23/255, green: 24/255, blue: 20/255))
      Rectangle()
        .fill(Color(red: 23/255, green: 24/255, blue: 20/255))
        .frame(height: 1)
      Text(isSpanish ? "\(configuration.pickups) ACTIVACIONES" : "\(configuration.pickups) PICKUPS")
        .font(.system(size: 11, weight: .medium, design: .monospaced))
        .foregroundStyle(Color(red: 93/255, green: 94/255, blue: 88/255))
    }
    .padding(.vertical, 12)
  }
}

struct WeeklyReportScene: DeviceActivityReportScene {
  let context: DeviceActivityReport.Context = .init("still.weekly")
  let content: ([TimeInterval]) -> WeeklyReportView

  func makeConfiguration(
    representing data: DeviceActivityResults<DeviceActivityData>
  ) async -> [TimeInterval] {
    var byDay: [Date: TimeInterval] = [:]
    for await deviceData in data {
      for await segment in deviceData.activitySegments {
        let day = Calendar.current.startOfDay(for: segment.dateInterval.start)
        byDay[day, default: 0] += segment.totalActivityDuration
      }
    }
    let today = Calendar.current.startOfDay(for: Date())
    return (-6...0).map { offset in
      let day = Calendar.current.date(byAdding: .day, value: offset, to: today) ?? today
      return byDay[day, default: 0]
    }
  }
}

struct WeeklyReportView: View {
  let values: [TimeInterval]
  private var isSpanish: Bool { Locale.preferredLanguages.first?.hasPrefix("es") == true }
  private var labels: [String] { isSpanish ? ["L", "M", "X", "J", "V", "S", "D"] : ["M", "T", "W", "T", "F", "S", "S"] }

  var body: some View {
    let maximum = max(values.max() ?? 1, 1)
    VStack(alignment: .leading, spacing: 14) {
      Text(isSpanish ? "ÚLTIMOS 7 DÍAS" : "LAST 7 DAYS")
        .font(.system(size: 11, weight: .semibold, design: .monospaced))
        .tracking(1.2)
        .foregroundStyle(Color(red: 93/255, green: 94/255, blue: 88/255))
      HStack(alignment: .bottom, spacing: 8) {
        ForEach(Array(values.enumerated()), id: \.offset) { index, value in
          VStack(spacing: 5) {
            Rectangle()
              .fill(index == values.count - 1
                ? Color(red: 255/255, green: 92/255, blue: 53/255)
                : Color(red: 23/255, green: 24/255, blue: 20/255))
              .frame(height: max(4, 62 * value / maximum))
            Text(labels[index])
              .font(.system(size: 10, weight: .medium, design: .monospaced))
              .foregroundStyle(Color(red: 93/255, green: 94/255, blue: 88/255))
          }
          .frame(maxWidth: .infinity)
        }
      }
      .frame(height: 84, alignment: .bottom)
    }
    .padding(.vertical, 12)
  }
}

@main
struct StillDeviceActivityReportExtension: DeviceActivityReportExtension {
  var body: some DeviceActivityReportScene {
    DailyReportScene { DailyReportView(configuration: $0) }
    WeeklyReportScene { WeeklyReportView(values: $0) }
  }
}
