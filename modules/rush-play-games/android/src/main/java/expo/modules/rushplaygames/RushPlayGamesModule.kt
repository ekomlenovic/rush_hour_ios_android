package expo.modules.rushplaygames

import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import com.google.android.gms.games.PlayGames
import com.google.android.gms.games.PlayGamesSdk
import com.google.android.gms.games.SnapshotsClient
import com.google.android.gms.games.snapshot.Snapshot
import com.google.android.gms.games.snapshot.SnapshotMetadataChange
import com.google.android.gms.tasks.Task
import com.google.android.gms.tasks.Tasks
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.util.concurrent.TimeUnit
import java.util.zip.GZIPInputStream
import java.util.zip.GZIPOutputStream

private const val APP_ID_KEY = "com.google.android.gms.games.APP_ID"
private const val PLAY_STORE = "com.android.vending"
private const val TIMEOUT_SECONDS = 30L

class PlayGamesException(code: String, cause: Throwable? = null) : CodedException(code, "Play Games: $code", cause)

/**
 * Saved Games of Play Games Services (issue 320): the save code of the game (the same as a .rushsave),
 * gzipped, in one snapshot. The merge of the versions found is done in JavaScript
 * (utils/cloudMerge.ts): this module only reads every version and writes the merged one.
 *
 * Only on an app installed from Google Play with a Play Games project id (plugins/withPlayGames.js):
 * anywhere else (APK from GitHub, a build without the id) nothing is initialized and isAvailable is false.
 */
class RushPlayGamesModule : Module() {
  private var available = false
  /** Snapshots opened by `open`, until `commit` or `discard` */
  private val opened = mutableMapOf<Int, Snapshot>()
  private var nextHandle = 1

  override fun definition() = ModuleDefinition {
    Name("RushPlayGames")

    OnCreate {
      val context = appContext.reactContext?.applicationContext ?: return@OnCreate
      if (!hasProjectId(context) || !installedFromPlayStore(context)) return@OnCreate
      available = try {
        PlayGamesSdk.initialize(context)
        true
      } catch (e: Exception) {
        false
      }
    }

    Function("isAvailable") { available }

    // Play Games signs the player in by itself at launch when they use it: never a sign-in screen here
    AsyncFunction("isSignedIn") {
      if (!available) return@AsyncFunction false
      await(PlayGames.getGamesSignInClient(activity()).isAuthenticated).isAuthenticated
    }

    // Asked by the player (Options → Sauvegarde): the Play Games sign-in screen
    AsyncFunction("signIn") {
      if (!available) return@AsyncFunction false
      await(PlayGames.getGamesSignInClient(activity()).signIn()).isAuthenticated
    }

    /**
     * Opens the snapshot and reads every version of it: on a conflict (two phones wrote it, one
     * offline) both versions are read before one is kept, the merged save is written over it.
     * Returns the handle to commit or discard, and the save codes read (none on a first sync).
     */
    AsyncFunction("open") { name: String ->
      val client = snapshots()
      val contents = mutableListOf<String>()
      var result = await(client.open(name, true, SnapshotsClient.RESOLUTION_POLICY_MANUAL))
      var conflicts = 0
      while (result.isConflict) {
        val conflict = result.conflict ?: throw PlayGamesException("conflict")
        readText(conflict.snapshot)?.let(contents::add)
        readText(conflict.conflictingSnapshot)?.let(contents::add)
        if (++conflicts > 10) throw PlayGamesException("conflict")
        result = await(client.resolveConflict(conflict.conflictId, conflict.snapshot))
      }
      val snapshot = result.data ?: throw PlayGamesException("open_failed")
      readText(snapshot)?.let(contents::add)
      val handle = synchronized(opened) {
        val handle = nextHandle++
        opened[handle] = snapshot
        handle
      }
      mapOf("handle" to handle, "contents" to contents.distinct())
    }

    AsyncFunction("commit") { handle: Int, data: String, description: String ->
      val snapshot = take(handle)
      val client = snapshots()
      val bytes = gzip(data)
      if (bytes.size > await(client.maxDataSize)) {
        await(client.discardAndClose(snapshot))
        throw PlayGamesException("too_big")
      }
      snapshot.snapshotContents.writeBytes(bytes)
      val change = SnapshotMetadataChange.Builder().setDescription(description).build()
      await(client.commitAndClose(snapshot, change))
      true
    }

    AsyncFunction("discard") { handle: Int ->
      val snapshot = synchronized(opened) { opened.remove(handle) } ?: return@AsyncFunction false
      await(snapshots().discardAndClose(snapshot))
      true
    }
  }

  private fun activity() = appContext.currentActivity ?: throw PlayGamesException("no_activity")

  private fun snapshots(): SnapshotsClient {
    if (!available) throw PlayGamesException("unavailable")
    return PlayGames.getSnapshotsClient(activity())
  }

  private fun take(handle: Int): Snapshot =
    synchronized(opened) { opened.remove(handle) } ?: throw PlayGamesException("closed")

  /** Async functions run off the main thread: waiting on a task is allowed there */
  private fun <T> await(task: Task<T>): T = try {
    Tasks.await(task, TIMEOUT_SECONDS, TimeUnit.SECONDS)
  } catch (e: Exception) {
    throw PlayGamesException("failed", e)
  }

  /** The save code of a version, null when empty (a snapshot just created) */
  private fun readText(snapshot: Snapshot?): String? {
    val bytes = snapshot?.snapshotContents?.readFully() ?: return null
    if (bytes.isEmpty()) return null
    val gzipped = bytes.size >= 2 && bytes[0] == 0x1f.toByte() && bytes[1] == 0x8b.toByte()
    val text = if (gzipped) GZIPInputStream(ByteArrayInputStream(bytes)).use { it.readBytes() } else bytes
    return String(text, Charsets.UTF_8).ifBlank { null }
  }

  private fun gzip(text: String): ByteArray {
    val out = ByteArrayOutputStream()
    GZIPOutputStream(out).use { it.write(text.toByteArray(Charsets.UTF_8)) }
    return out.toByteArray()
  }

  /** The Play Games project id written by plugins/withPlayGames.js: without it, Play Games is not set up */
  private fun hasProjectId(context: Context): Boolean = try {
    @Suppress("DEPRECATION")
    val info = context.packageManager.getApplicationInfo(context.packageName, PackageManager.GET_META_DATA)
    !info.metaData?.get(APP_ID_KEY)?.toString().isNullOrBlank()
  } catch (e: Exception) {
    false
  }

  /** Installed by Google Play (also its testing tracks): the APK from GitHub never syncs */
  private fun installedFromPlayStore(context: Context): Boolean = try {
    val installer = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      context.packageManager.getInstallSourceInfo(context.packageName).installingPackageName
    } else {
      @Suppress("DEPRECATION")
      context.packageManager.getInstallerPackageName(context.packageName)
    }
    installer == PLAY_STORE
  } catch (e: Exception) {
    false
  }
}
