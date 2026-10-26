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
  /// Same key as the app (modules/rush-widget/ios/RushWidgetModule.swift)
  static let dataKey = "widgetData"

  /// What the app wrote last, in the app group (RushAppGroup.swift)
  static func load() -> WidgetData? {
    guard let json = RushAppGroup.defaults?.string(forKey: dataKey),
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

/// The app writes its texts in its own language; these are for the gallery and while it has written nothing
enum WidgetStrings {
  private static let language = Locale.preferredLanguages.first ?? "en"
  private static let french = language.hasPrefix("fr")
  private static let serbian = language.hasPrefix("sr")

  /// The phone's language among the app's: French, Serbian (Latin script, as in the app), else English
  private static func pick(_ fr: String, _ sr: String, _ en: String) -> String {
    french ? fr : serbian ? sr : en
  }

  static let name = pick("Streak et défi du jour", "Niz i dnevni izazov", "Streak and daily challenge")
  static let description = pick(
    "Ton streak, tes gels et le défi du jour. En grand : le temps avant le prochain.",
    "Tvoj niz, tvoja zamrzavanja i dnevni izazov. Veća veličina: vreme do sledećeg.",
    "Your streak, your freezes and today's challenge. Medium size: the time left before the next one."
  )
  static let daily = pick("Défi du jour", "Dnevni izazov", "Daily challenge")
  static let todo = pick("À faire", "Za uraditi", "To do")
  static let unit = pick("jours de streak", "dana niza", "day streak")
  static let nextIn = pick("Prochain défi dans", "Sledeći izazov za", "Next challenge in")
  static let danger = pick("Streak en danger", "Niz u opasnosti", "Streak in danger")
  static let timeLeft = pick("Il te reste", "Preostalo vreme", "Time left")
  static let play = pick("Touche pour jouer", "Dodirni da igraš", "Tap to play")
  /// Nothing written yet: an update not opened yet, never a streak at 0 that would be wrong
  static let openApp = pick(
    "Ouvre Rush Hours pour afficher ton streak.",
    "Otvori Rush Hours da vidiš svoj niz.",
    "Open Rush Hours to show your streak."
  )
  /// No app group: this install cannot share the app's data with the widget
  static let noAccess = pick(
    "Le widget ne peut pas lire les données de Rush Hours sur cette installation.",
    "Vidžet ne može da čita podatke aplikacije Rush Hours na ovoj instalaciji.",
    "The widget cannot read Rush Hours' data on this install."
  )
  static let previewLabel = pick(
    "Streak de 7 jours, 2 gels, défi du jour à faire",
    "Niz od 7 dana, 2 zamrzavanja, dnevni izazov za uraditi",
    "7-day streak, 2 freezes, daily challenge to do"
  )
}
