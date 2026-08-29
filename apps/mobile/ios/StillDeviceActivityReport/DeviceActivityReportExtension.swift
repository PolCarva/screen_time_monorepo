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
        .font(.system(size: 10, weight: .semibold))
        .tracking(1.2)
        .foregroundStyle(Color(red: 78/255, green: 84/255, blue: 81/255))
      Text(Duration.seconds(configuration.totalSeconds).formatted(.time(pattern: .hourMinute)))
        .font(.system(size: 42, weight: .medium, design: .monospaced))
        .tracking(-2)
        .foregroundStyle(Color(red: 36/255, green: 40/255, blue: 38/255))
      Rectangle()
        .fill(Color(red: 217/255, green: 222/255, blue: 220/255))
        .frame(height: 1)
      Text(isSpanish ? "\(configuration.pickups) ACTIVACIONES" : "\(configuration.pickups) PICKUPS")
        .font(.system(size: 11, weight: .medium))
        .foregroundStyle(Color(red: 78/255, green: 84/255, blue: 81/255))
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
        .font(.system(size: 10, weight: .semibold))
        .tracking(1.2)
        .foregroundStyle(Color(red: 78/255, green: 84/255, blue: 81/255))
      HStack(alignment: .bottom, spacing: 8) {
        ForEach(Array(values.enumerated()), id: \.offset) { index, value in
          let activeCount = value <= 0 ? 0 : max(1, Int((value / maximum * 5).rounded()))
          VStack(spacing: 5) {
            VStack(spacing: 4) {
              ForEach(0..<5, id: \.self) { module in
                RoundedRectangle(cornerRadius: 2)
                  .fill(module < activeCount
                    ? Color(red: 105/255, green: 127/255, blue: 140/255).opacity(0.58 + Double(module) * 0.08)
                    : Color(red: 217/255, green: 222/255, blue: 220/255).opacity(0.6))
                  .frame(height: 8)
              }
            }
            Text(labels[index])
              .font(.system(size: 10, weight: index == values.count - 1 ? .bold : .medium))
              .foregroundStyle(Color(red: 78/255, green: 84/255, blue: 81/255))
          }
          .frame(maxWidth: .infinity)
        }
      }
      .frame(height: 82, alignment: .bottom)
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
