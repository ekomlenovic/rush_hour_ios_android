package expo.modules.rushdevice

import android.content.pm.PackageManager
import android.os.Build
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

    // The app that installed this one ("com.android.vending" for Google Play), null for an APK installed by hand
    Function("installerPackage") {
      val context = appContext.reactContext
      try {
        when {
          context == null -> null
          Build.VERSION.SDK_INT >= Build.VERSION_CODES.R ->
            context.packageManager.getInstallSourceInfo(context.packageName).installingPackageName
          else ->
            @Suppress("DEPRECATION")
            context.packageManager.getInstallerPackageName(context.packageName)
        }
      } catch (e: Exception) {
        null
      }
    }
  }
}
