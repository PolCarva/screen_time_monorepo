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
  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      Text("Screen time").font(.caption).foregroundStyle(.secondary)
      Text(Duration.seconds(configuration.totalSeconds).formatted(.time(pattern: .hourMinute)))
        .font(.system(size: 38, weight: .semibold, design: .serif))
      Text("\(configuration.pickups) pickups").font(.caption).foregroundStyle(.secondary)
    }
    .padding()
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
  private let labels = ["M", "T", "W", "T", "F", "S", "S"]

  var body: some View {
    let maximum = max(values.max() ?? 1, 1)
    VStack(alignment: .leading, spacing: 12) {
      Text("Last 7 days").font(.caption).foregroundStyle(.secondary)
      HStack(alignment: .bottom, spacing: 10) {
        ForEach(Array(values.enumerated()), id: \.offset) { index, value in
          VStack(spacing: 5) {
            RoundedRectangle(cornerRadius: 4)
              .fill(Color(red: 168/255, green: 181/255, blue: 154/255))
              .frame(height: max(6, 58 * value / maximum))
            Text(labels[index]).font(.caption2).foregroundStyle(.secondary)
          }
          .frame(maxWidth: .infinity)
        }
      }
      .frame(height: 82, alignment: .bottom)
    }
    .padding()
  }
}

@main
struct StillDeviceActivityReportExtension: DeviceActivityReportExtension {
  var body: some DeviceActivityReportScene {
    DailyReportScene { DailyReportView(configuration: $0) }
    WeeklyReportScene { WeeklyReportView(values: $0) }
  }
}
