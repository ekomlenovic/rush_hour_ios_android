package expo.modules.rushdevice

import android.content.pm.PackageManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** What the phone has that the app uses only when present (the camera is optional in the manifest) */
class RushDeviceModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("RushDevice")

    // The camera the QR code scanner can use: "back", "front" (most Chromebooks) or null (none)
    Function("scannerCamera") {
      val packageManager = appContext.reactContext?.packageManager
      when {
        packageManager == null -> null
        packageManager.hasSystemFeature(PackageManager.FEATURE_CAMERA) -> "back"
        packageManager.hasSystemFeature(PackageManager.FEATURE_CAMERA_FRONT) -> "front"
        else -> null
      }
    }
  }
}
