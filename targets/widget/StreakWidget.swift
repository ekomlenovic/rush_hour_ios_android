import SwiftUI
import WidgetKit

/// Medium widget's extra column (utils/widget.ts, widgetExtra)
enum WidgetExtra {
  /// Daily done: countdown to the next one
  case next
  /// Evening, daily not done with a streak to lose: countdown to midnight
  case danger
  case play
}

struct StreakEntry: TimelineEntry {
  let date: Date
  let data: WidgetData
  let day: WidgetDay
  let extra: WidgetExtra
  /// Next local midnight: the next daily challenge
  let midnight: Date

  init(date: Date, data: WidgetData) {
    let day = data.day(for: localDateKey(date))
    let hour = widgetCalendar.component(.hour, from: date)
    let startOfDay = widgetCalendar.startOfDay(for: date)
    self.date = date
    self.data = data
    self.day = day
    self.extra = day.done ? .next : (day.danger && hour >= data.dangerHour ? .danger : .play)
    self.midnight = widgetCalendar.date(byAdding: .day, value: 1, to: startOfDay) ?? startOfDay.addingTimeInterval(86_400)
  }
}

/**
 * The entry of each day comes from what the app wrote: one timeline entry at each change
 * ("streak in danger" in the evening, then each midnight), so the widget shows the new day
 * at midnight without the app (rules in docs/GAME_DESIGN.md, issue 151).
 */
struct StreakProvider: TimelineProvider {
  /// Days planned ahead; the timeline is asked again after the last one
  private let daysAhead = 7

  func placeholder(in context: Context) -> StreakEntry {
    StreakEntry(date: Date(), data: WidgetData.preview)
  }

  func getSnapshot(in context: Context, completion: @escaping (StreakEntry) -> Void) {
    completion(StreakEntry(date: Date(), data: WidgetData.load() ?? (context.isPreview ? WidgetData.preview : WidgetData.empty)))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<StreakEntry>) -> Void) {
    let data = WidgetData.load() ?? WidgetData.empty
    let now = Date()
    var dates = [now]
    var day = widgetCalendar.startOfDay(for: now)
    for _ in 0..<daysAhead {
      guard let next = widgetCalendar.date(byAdding: .day, value: 1, to: day) else { break }
      if let evening = widgetCalendar.date(bySettingHour: data.dangerHour, minute: 0, second: 0, of: day), evening > now {
        dates.append(evening)
      }
      dates.append(next)
      day = next
    }
    completion(Timeline(entries: dates.map { StreakEntry(date: $0, data: data) }, policy: .atEnd))
  }
}

/// Freeze slots, filled or empty, as in the profile (StreakCard)
struct FreezeSlots: View {
  let freezes: Int
  let capacity: Int

  var body: some View {
    HStack(spacing: 3) {
      ForEach(0..<max(capacity, 0), id: \.self) { index in
        if index < freezes {
          Image(systemName: "snowflake")
            .font(.system(size: 9, weight: .bold))
            .foregroundStyle(Color("rushOnFrozen"))
            .frame(width: 18, height: 16)
            .background(RoundedRectangle(cornerRadius: 4).fill(Color("rushFrozen")))
        } else {
          Image(systemName: "snowflake")
            .font(.system(size: 9, weight: .bold))
            .foregroundStyle(Color("rushFrozen"))
            .frame(width: 18, height: 16)
            .overlay(RoundedRectangle(cornerRadius: 4).strokeBorder(Color("rushFrozen"), style: StrokeStyle(lineWidth: 1, dash: [2, 2])))
        }
      }
    }
  }
}

struct StarsView: View {
  let stars: Int

  var body: some View {
    HStack(spacing: 1) {
      ForEach(0..<3, id: \.self) { index in
        Image(systemName: index < stars ? "star.fill" : "star")
          .font(.system(size: 10, weight: .semibold))
          .foregroundStyle(index < stars ? Color("rushStar") : Color("rushMuted"))
      }
    }
  }
}

/// Streak, freezes and the daily challenge: the small widget, and the left of the medium one
struct StreakColumn: View {
  let entry: StreakEntry

  var body: some View {
    let day = entry.day
    VStack(alignment: .leading, spacing: 0) {
      HStack(spacing: 4) {
        Image(systemName: "flame.fill")
          .font(.system(size: 22, weight: .semibold))
          .foregroundStyle(day.streak > 0 ? Color("rushFlame") : Color("rushMuted"))
        Text("\(day.streak)")
          .font(.system(size: 32, weight: .heavy, design: .rounded))
          .foregroundStyle(Color("rushText"))
          .lineLimit(1)
          .minimumScaleFactor(0.6)
      }
      Text(day.unit)
        .font(.caption)
        .foregroundStyle(Color("rushMuted"))
        .lineLimit(1)
      FreezeSlots(freezes: day.freezes, capacity: entry.data.capacity)
        .padding(.top, 6)
      Spacer(minLength: 4)
      Text(entry.data.texts.daily)
        .font(.caption2)
        .foregroundStyle(Color("rushMuted"))
        .lineLimit(1)
      HStack(spacing: 4) {
        Image(systemName: day.done ? "checkmark.circle.fill" : "circle")
          .font(.system(size: 13, weight: .semibold))
          .foregroundStyle(day.done ? Color("rushSuccess") : Color("rushMuted"))
        Text(day.status)
          .font(.subheadline.bold())
          .foregroundStyle(day.done ? Color("rushSuccess") : Color("rushText"))
          .lineLimit(1)
          .minimumScaleFactor(0.8)
        if day.done {
          StarsView(stars: day.stars)
        }
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
  }
}

/// Medium widget: countdown, "streak in danger" or "tap to play"
struct ExtraColumn: View {
  let entry: StreakEntry

  var body: some View {
    let texts = entry.data.texts
    VStack(alignment: .leading, spacing: 4) {
      switch entry.extra {
      case .next:
        Image(systemName: "clock.fill")
          .font(.system(size: 20))
          .foregroundStyle(Color("rushMuted"))
        Text(texts.nextIn)
          .font(.footnote)
          .foregroundStyle(Color("rushText"))
        countdown
      case .danger:
        Image(systemName: "exclamationmark.triangle.fill")
          .font(.system(size: 20))
          .foregroundStyle(Color("rushDanger"))
        Text(texts.danger)
          .font(.subheadline.bold())
          .foregroundStyle(Color("rushDanger"))
        Text(texts.timeLeft)
          .font(.caption2)
          .foregroundStyle(Color("rushMuted"))
        countdown
      case .play:
        Image(systemName: "play.fill")
          .font(.system(size: 20))
          .foregroundStyle(Color("rushPrimary"))
        Text(texts.play)
          .font(.footnote)
          .foregroundStyle(Color("rushText"))
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
  }

  /// Counts down to midnight, live
  private var countdown: some View {
    Text(timerInterval: entry.date...entry.midnight, countsDown: true)
      .font(.system(size: 24, weight: .bold, design: .rounded))
      .monospacedDigit()
      .foregroundStyle(Color("rushText"))
      .lineLimit(1)
      .minimumScaleFactor(0.7)
  }
}

struct StreakWidgetView: View {
  @Environment(\.widgetFamily) private var family
  let entry: StreakEntry

  /// Read in one go by VoiceOver
  private var label: String {
    family == .systemMedium && entry.extra == .danger ? "\(entry.day.label). \(entry.data.texts.danger)" : entry.day.label
  }

  var body: some View {
    content
      .accessibilityElement(children: .ignore)
      .accessibilityLabel(Text(label))
      // Opens today's daily: the app dates the link when it opens it
      .widgetURL(URL(string: entry.data.link))
      .widgetBackground()
  }

  @ViewBuilder
  private var content: some View {
    if family == .systemMedium {
      HStack(spacing: 12) {
        StreakColumn(entry: entry)
        Divider()
        ExtraColumn(entry: entry)
      }
    } else {
      StreakColumn(entry: entry)
    }
  }
}

extension View {
  /// iOS 17 draws the background (and the margins) itself
  @ViewBuilder
  func widgetBackground() -> some View {
    if #available(iOSApplicationExtension 17.0, *) {
      containerBackground(Color("rushBackground"), for: .widget)
    } else {
      padding().background(Color("rushBackground"))
    }
  }
}

struct StreakWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "StreakWidget", provider: StreakProvider()) { entry in
      StreakWidgetView(entry: entry)
    }
    .configurationDisplayName(WidgetStrings.name)
    .description(WidgetStrings.description)
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}
