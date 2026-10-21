import Foundation

/// What the widget shows on one day (utils/widget.ts, WidgetDay)
struct WidgetDay: Codable {
  let date: String
  let streak: Int
  let freezes: Int
  let done: Bool
  let stars: Int
  let unit: String
  let status: String
  let label: String
  let danger: Bool
}

struct WidgetTexts: Codable {
  let daily: String
  let nextIn: String
  let danger: String
  let timeLeft: String
  let play: String
}

/// What the app wrote for the widget (utils/widget.ts, WidgetData), in the app's language
struct WidgetData: Codable {
  let version: Int
  let capacity: Int
  let dangerHour: Int
  let link: String
  let texts: WidgetTexts
  let days: [WidgetDay]

  /// WIDGET_DATA_VERSION: data in another format is ignored until the app writes it again
  static let currentVersion = 1
  /// Same key and app group as the app (modules/rush-widget/ios/RushWidgetModule.swift)
  static let dataKey = "widgetData"
  static let defaultAppGroup = "group.com.rushhours.app"

  /// SideStore registers the app group under the player's team ("group.com.rushhours.app.TEAMID")
  /// and writes the real identifier in the Info.plist (ALTAppGroups)
  static let appGroup: String = {
    let groups = Bundle.main.object(forInfoDictionaryKey: "ALTAppGroups") as? [String] ?? []
    return groups.first { $0.hasPrefix(defaultAppGroup) } ?? defaultAppGroup
  }()

  static func load() -> WidgetData? {
    guard let json = UserDefaults(suiteName: appGroup)?.string(forKey: dataKey),
          let data = try? JSONDecoder().decode(WidgetData.self, from: Data(json.utf8)),
          data.version == currentVersion,
          !data.days.isEmpty
    else { return nil }
    return data
  }

  /// Same rule as widgetDayFor: the entry of the date, the last one after, the first one before
  func day(for dateKey: String) -> WidgetDay {
    if let day = days.first(where: { $0.date == dateKey }) { return day }
    return dateKey > days[days.count - 1].date ? days[days.count - 1] : days[0]
  }

  /// Until the app has been opened once: no streak yet, in the phone's language
  static var empty: WidgetData {
    sample(streak: 0, freezes: 0, capacity: 2, unit: WidgetStrings.unitOne, label: WidgetStrings.emptyLabel)
  }

  /// The widget gallery's preview
  static var preview: WidgetData {
    sample(streak: 7, freezes: 2, capacity: 3, unit: WidgetStrings.unit, label: WidgetStrings.previewLabel)
  }

  private static func sample(streak: Int, freezes: Int, capacity: Int, unit: String, label: String) -> WidgetData {
    WidgetData(
      version: currentVersion,
      capacity: capacity,
      dangerHour: 21,
      link: "rush-hours://game?levelId=daily",
      texts: WidgetTexts(
        daily: WidgetStrings.daily,
        nextIn: WidgetStrings.nextIn,
        danger: WidgetStrings.danger,
        timeLeft: WidgetStrings.timeLeft,
        play: WidgetStrings.play
      ),
      days: [
        WidgetDay(
          date: localDateKey(Date()),
          streak: streak,
          freezes: freezes,
          done: false,
          stars: 0,
          unit: unit,
          status: WidgetStrings.todo,
          label: label,
          danger: false
        ),
      ]
    )
  }
}

/// Dates of the challenges: Gregorian calendar in the phone's time zone, as JavaScript's Date
let widgetCalendar: Calendar = {
  var calendar = Calendar(identifier: .gregorian)
  calendar.timeZone = .current
  return calendar
}()

/// Local YYYY-MM-DD key, as getLocalDateString (utils/date.ts)
func localDateKey(_ date: Date) -> String {
  let parts = widgetCalendar.dateComponents([.year, .month, .day], from: date)
  return String(format: "%04d-%02d-%02d", parts.year ?? 0, parts.month ?? 0, parts.day ?? 0)
}

/// The app writes its texts in its own language; these are for the gallery and until it has been opened
enum WidgetStrings {
  static let french = Locale.preferredLanguages.first?.hasPrefix("fr") ?? false

  static let name = french ? "Streak et défi du jour" : "Streak and daily challenge"
  static let description = french
    ? "Ton streak, tes gels et le défi du jour. En grand : le temps avant le prochain."
    : "Your streak, your freezes and today's challenge. Medium size: the time left before the next one."
  static let daily = french ? "Défi du jour" : "Daily challenge"
  static let todo = french ? "À faire" : "To do"
  static let unit = french ? "jours de streak" : "day streak"
  static let unitOne = french ? "jour de streak" : "day streak"
  static let nextIn = french ? "Prochain défi dans" : "Next challenge in"
  static let danger = french ? "Streak en danger" : "Streak in danger"
  static let timeLeft = french ? "Il te reste" : "Time left"
  static let play = french ? "Touche pour jouer" : "Tap to play"
  static let emptyLabel = french ? "Streak de 0 jour, défi du jour à faire" : "0-day streak, daily challenge to do"
  static let previewLabel = french ? "Streak de 7 jours, 2 gels, défi du jour à faire" : "7-day streak, 2 freezes, daily challenge to do"
}
