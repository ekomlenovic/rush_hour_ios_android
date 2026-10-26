package expo.modules.rushwidget

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.SystemClock
import android.text.format.DateUtils
import android.view.View
import android.widget.RemoteViews
import java.util.Calendar

/**
 * Home screen widgets (issue 151, rules in docs/GAME_DESIGN.md): streak, freezes and the daily
 * challenge of the day, read from what the app wrote (WidgetStore). The entry of the day is picked
 * from the date: an alarm redraws them just after midnight, without the app.
 */
object StreakWidgets {
  const val ACTION_TICK = "expo.modules.rushwidget.TICK"
  /** WIDGET_DAILY_LINK, while the app has written nothing */
  private const val DAILY_LINK = "rush-hours://game?levelId=daily"

  /** Android 12+ delivers an inexact alarm within 10 minutes at best */
  private const val ALARM_WINDOW_MS = 10 * 60 * 1000L
  /** A moment after midnight: the new day is sure to have begun */
  private const val ALARM_DELAY_MS = 1000L
  /**
   * The countdown stops this long before midnight (issue 190): a Chronometer counting down goes
   * negative past zero, and the midnight alarm is inexact. An alarm in the window before redraws it
   * as a bound ("< 08:00") that never goes below zero, and the window ends before midnight.
   */
  private const val FINAL_MS = 15 * 60 * 1000L

  private val SLOTS = intArrayOf(
    R.id.rush_widget_slot_0, R.id.rush_widget_slot_1, R.id.rush_widget_slot_2,
    R.id.rush_widget_slot_3, R.id.rush_widget_slot_4, R.id.rush_widget_slot_5,
  )
  private val STARS = intArrayOf(R.id.rush_widget_star_0, R.id.rush_widget_star_1, R.id.rush_widget_star_2)

  private enum class Extra { NEXT, DANGER, PLAY }

  /** Redraws every widget placed, and plans the next redraw */
  fun updateAll(context: Context) {
    val manager = AppWidgetManager.getInstance(context)
    val data = WidgetStore.read(context)
    val now = Calendar.getInstance()
    var placed = false
    for ((provider, wide) in listOf(StreakWidgetProvider::class.java to false, StreakWidgetWideProvider::class.java to true)) {
      val ids = manager.getAppWidgetIds(ComponentName(context, provider))
      if (ids.isEmpty()) continue
      placed = true
      manager.updateAppWidget(ids, render(context, data, now, wide))
    }
    // Without data, the app redraws the widgets as soon as it writes
    if (placed && data != null) scheduleNext(context, data, now) else alarms(context).cancel(tickIntent(context))
  }

  private fun extraOf(data: WidgetData, day: WidgetDay, now: Calendar): Extra = when {
    day.done -> Extra.NEXT
    day.danger && now.get(Calendar.HOUR_OF_DAY) >= data.dangerHour -> Extra.DANGER
    else -> Extra.PLAY
  }

  private fun render(context: Context, data: WidgetData?, now: Calendar, wide: Boolean): RemoteViews {
    val views = RemoteViews(context.packageName, if (wide) R.layout.rush_widget_medium else R.layout.rush_widget_small)
    // Nothing written yet (an update not opened yet): says so, never a streak at 0 that would be wrong
    if (data == null) {
      views.setViewVisibility(R.id.rush_widget_content, View.GONE)
      views.setViewVisibility(R.id.rush_widget_message, View.VISIBLE)
      views.setContentDescription(android.R.id.background, context.getString(R.string.rush_widget_open_app))
      views.setOnClickPendingIntent(android.R.id.background, openIntent(context, DAILY_LINK))
      return views
    }
    val day = data.dayFor(localDateKey(now))

    views.setImageViewResource(R.id.rush_widget_flame, if (day.streak > 0) R.drawable.rush_widget_flame else R.drawable.rush_widget_flame_off)
    views.setTextViewText(R.id.rush_widget_streak, day.streak.toString())
    views.setTextViewText(R.id.rush_widget_unit, day.unit)
    SLOTS.forEachIndexed { i, slot ->
      val filled = i < day.freezes
      views.setViewVisibility(slot, if (i < data.capacity) View.VISIBLE else View.GONE)
      views.setImageViewResource(slot, if (filled) R.drawable.rush_widget_snow_filled else R.drawable.rush_widget_snow_empty)
      views.setInt(slot, "setBackgroundResource", if (filled) R.drawable.rush_widget_slot_filled else R.drawable.rush_widget_slot_empty)
    }

    views.setTextViewText(R.id.rush_widget_daily, data.daily)
    views.setImageViewResource(R.id.rush_widget_status_icon, if (day.done) R.drawable.rush_widget_done else R.drawable.rush_widget_todo)
    val status = if (day.done) R.id.rush_widget_done else R.id.rush_widget_todo
    views.setTextViewText(status, day.status)
    views.setViewVisibility(R.id.rush_widget_done, if (day.done) View.VISIBLE else View.GONE)
    views.setViewVisibility(R.id.rush_widget_todo, if (day.done) View.GONE else View.VISIBLE)
    STARS.forEachIndexed { i, star ->
      views.setViewVisibility(star, if (day.done) View.VISIBLE else View.GONE)
      views.setImageViewResource(star, if (i < day.stars) R.drawable.rush_widget_star else R.drawable.rush_widget_star_empty)
    }

    var label = day.label
    if (wide) {
      val extra = extraOf(data, day, now)
      views.setImageViewResource(
        R.id.rush_widget_extra_icon,
        when (extra) {
          Extra.NEXT -> R.drawable.rush_widget_time
          Extra.DANGER -> R.drawable.rush_widget_danger
          Extra.PLAY -> R.drawable.rush_widget_play
        },
      )
      views.setTextViewText(R.id.rush_widget_extra_title, if (extra == Extra.NEXT) data.nextIn else data.play)
      views.setTextViewText(R.id.rush_widget_extra_danger, data.danger)
      views.setTextViewText(R.id.rush_widget_extra_caption, data.timeLeft)
      views.setViewVisibility(R.id.rush_widget_extra_title, if (extra == Extra.DANGER) View.GONE else View.VISIBLE)
      views.setViewVisibility(R.id.rush_widget_extra_danger, if (extra == Extra.DANGER) View.VISIBLE else View.GONE)
      views.setViewVisibility(R.id.rush_widget_extra_caption, if (extra == Extra.DANGER) View.VISIBLE else View.GONE)

      // Counts down to midnight: the next daily, or the end of the streak; in the last minutes, a bound
      val counting = extra != Extra.PLAY
      val untilMidnight = nextMidnight(now) - now.timeInMillis
      val running = counting && untilMidnight > FINAL_MS
      views.setViewVisibility(R.id.rush_widget_timer, if (running) View.VISIBLE else View.GONE)
      views.setChronometer(R.id.rush_widget_timer, SystemClock.elapsedRealtime() + untilMidnight, null, running)
      views.setChronometerCountDown(R.id.rush_widget_timer, true)
      views.setViewVisibility(R.id.rush_widget_timer_bound, if (counting && !running) View.VISIBLE else View.GONE)
      val minutes = untilMidnight / 60_000 + 1
      views.setTextViewText(R.id.rush_widget_timer_bound, "< " + DateUtils.formatElapsedTime(minutes * 60))
      if (extra == Extra.DANGER) label = "$label. ${data.danger}"
    }

    // Read in one go by TalkBack; a touch opens today's daily (the app dates the link)
    views.setContentDescription(android.R.id.background, label)
    views.setOnClickPendingIntent(android.R.id.background, openIntent(context, data.link))
    return views
  }

  private fun openIntent(context: Context, link: String): PendingIntent {
    val open = Intent(Intent.ACTION_VIEW, Uri.parse(link))
      .setPackage(context.packageName)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    return PendingIntent.getActivity(context, 0, open, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }

  /**
   * Next change of what the widgets show: "streak in danger" in the evening, the countdown stopped
   * before midnight (delivered by midnight - FINAL_MS + ALARM_WINDOW_MS), or the next day
   */
  private fun scheduleNext(context: Context, data: WidgetData, now: Calendar) {
    val day = data.dayFor(localDateKey(now))
    val evening = todayAt(now, data.dangerHour)
    val midnight = nextMidnight(now)
    val lastMinutes = midnight - FINAL_MS
    val alarms = alarms(context)
    when {
      day.danger && now.timeInMillis < evening -> alarms.setWindow(AlarmManager.RTC, evening + ALARM_DELAY_MS, ALARM_WINDOW_MS, tickIntent(context))
      (day.done || day.danger) && now.timeInMillis < lastMinutes -> alarms.setWindow(AlarmManager.RTC, lastMinutes, ALARM_WINDOW_MS, tickIntent(context))
      else -> alarms.setWindow(AlarmManager.RTC, midnight + ALARM_DELAY_MS, ALARM_WINDOW_MS, tickIntent(context))
    }
  }

  private fun alarms(context: Context): AlarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

  private fun tickIntent(context: Context): PendingIntent = PendingIntent.getBroadcast(
    context,
    0,
    Intent(context, StreakWidgetProvider::class.java).setAction(ACTION_TICK),
    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
  )
}

/** 2×2 widget; also receives the alarm and the clock changes for both widgets */
open class StreakWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
    StreakWidgets.updateAll(context)
  }

  override fun onReceive(context: Context, intent: Intent) {
    super.onReceive(context, intent)
    when (intent.action) {
      StreakWidgets.ACTION_TICK, Intent.ACTION_TIME_CHANGED, Intent.ACTION_TIMEZONE_CHANGED -> StreakWidgets.updateAll(context)
    }
  }

  /** The last widget of this size is removed: the alarm stops if no widget is left */
  override fun onDisabled(context: Context) {
    StreakWidgets.updateAll(context)
  }
}

/** 4×2 widget, with the countdown */
class StreakWidgetWideProvider : StreakWidgetProvider()
