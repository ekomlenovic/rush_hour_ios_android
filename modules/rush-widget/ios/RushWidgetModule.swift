import ExpoModulesCore
import WidgetKit

/// Writes what the home screen widget shows (utils/widget.ts) in the app group shared with the
/// widget extension (targets/widget), then asks for the widget to be redrawn (issue 151)
public class RushWidgetModule: Module {
  public func definition() -> ModuleDefinition {
    Name("RushWidget")

    Function("setData") { (json: String) in
      UserDefaults(suiteName: RushWidgetModule.appGroup)?.set(json, forKey: RushWidgetModule.dataKey)
      WidgetCenter.shared.reloadAllTimelines()
    }
  }

  /// Same key and app group as the widget extension (targets/widget/WidgetData.swift)
  static let dataKey = "widgetData"
  static let defaultAppGroup = "group.com.rushhours.app"

  /// SideStore registers the app group under the player's team ("group.com.rushhours.app.TEAMID")
  /// and writes the real identifier in the Info.plist (ALTAppGroups)
  static let appGroup: String = {
    let groups = Bundle.main.object(forInfoDictionaryKey: "ALTAppGroups") as? [String] ?? []
    return groups.first { $0.hasPrefix(defaultAppGroup) } ?? defaultAppGroup
  }()
}
