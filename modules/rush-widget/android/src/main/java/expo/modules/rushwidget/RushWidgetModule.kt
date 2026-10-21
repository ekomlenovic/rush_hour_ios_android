package expo.modules.rushwidget

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** Saves what the home screen widget shows (utils/widget.ts), then redraws it (issue 151) */
class RushWidgetModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("RushWidget")

    Function("setData") { json: String ->
      val context = appContext.reactContext
      if (context != null) {
        WidgetStore.write(context, json)
        StreakWidgets.updateAll(context)
      }
    }
  }
}
