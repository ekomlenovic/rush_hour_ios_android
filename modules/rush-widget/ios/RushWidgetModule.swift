import ExpoModulesCore
import WidgetKit

/// Writes what the home screen widget shows (utils/widget.ts) in the app group shared with the
/// widget extension (targets/widget), then asks for the widget to be redrawn (issue 151)
public class RushWidgetModule: Module {
  public func definition() -> ModuleDefinition {
    Name("RushWidget")

    Function("setData") { (json: String) in
      // Without the app group (an install that has none), the widget could not read it anyway
      RushAppGroup.defaults?.set(json, forKey: RushWidgetModule.dataKey)
      WidgetCenter.shared.reloadAllTimelines()
    }
  }

  /// Same key as the widget extension (targets/widget/WidgetData.swift)
  static let dataKey = "widgetData"
}
