package expo.modules.rushwidget

import android.content.Context
import org.json.JSONException
import org.json.JSONObject
import java.util.Calendar
import java.util.Locale

/** What the widget shows on one day (utils/widget.ts, WidgetDay) */
data class WidgetDay(
  val date: String,
  val streak: Int,
  val freezes: Int,
  val done: Boolean,
  val stars: Int,
  val unit: String,
  val status: String,
  val label: String,
  val danger: Boolean,
)

/** What the app wrote for the widget (utils/widget.ts, WidgetData), in the app's language */
class WidgetData(
  val capacity: Int,
  val dangerHour: Int,
  val link: String,
  val daily: String,
  val nextIn: String,
  val danger: String,
  val timeLeft: String,
  val play: String,
  val days: List<WidgetDay>,
) {
  /** Same rule as widgetDayFor: the entry of the date, the last one after, the first one before */
  fun dayFor(dateKey: String): WidgetDay =
    days.firstOrNull { it.date == dateKey } ?: if (dateKey > days.last().date) days.last() else days.first()

  companion object {
    /** WIDGET_DATA_VERSION: data in another format is ignored until the app writes it again */
    private const val VERSION = 1
    private const val DAILY_LINK = "rush-hours://game?levelId=daily"
    private const val BASE_FREEZE_SLOTS = 2
    private const val DEFAULT_DANGER_HOUR = 21

    fun parse(json: String?): WidgetData? {
      if (json == null) return null
      return try {
        val root = JSONObject(json)
        if (root.getInt("version") != VERSION) return null
        val texts = root.getJSONObject("texts")
        val list = root.getJSONArray("days")
        val days = (0 until list.length()).map { i ->
          val day = list.getJSONObject(i)
          WidgetDay(
            date = day.getString("date"),
            streak = day.getInt("streak"),
            freezes = day.getInt("freezes"),
            done = day.getBoolean("done"),
            stars = day.getInt("stars"),
            unit = day.getString("unit"),
            status = day.getString("status"),
            label = day.getString("label"),
            danger = day.getBoolean("danger"),
          )
        }
        if (days.isEmpty()) return null
        WidgetData(
          capacity = root.getInt("capacity"),
          dangerHour = root.getInt("dangerHour"),
          link = root.getString("link"),
          daily = texts.getString("daily"),
          nextIn = texts.getString("nextIn"),
          danger = texts.getString("danger"),
          timeLeft = texts.getString("timeLeft"),
          play = texts.getString("play"),
          days = days,
        )
      } catch (e: JSONException) {
        null
      }
    }

    /** Until the app has been opened once: no streak yet, in the phone's language */
    fun empty(context: Context): WidgetData {
      val res = context.resources
      return WidgetData(
        capacity = BASE_FREEZE_SLOTS,
        dangerHour = DEFAULT_DANGER_HOUR,
        link = DAILY_LINK,
        daily = res.getString(R.string.rush_widget_daily),
        nextIn = res.getString(R.string.rush_widget_next_in),
        danger = res.getString(R.string.rush_widget_danger),
        timeLeft = res.getString(R.string.rush_widget_time_left),
        play = res.getString(R.string.rush_widget_play),
        days = listOf(
          WidgetDay(
            date = localDateKey(Calendar.getInstance()),
            streak = 0,
            freezes = 0,
            done = false,
            stars = 0,
            unit = res.getQuantityString(R.plurals.rush_widget_days, 0),
            status = res.getString(R.string.rush_widget_todo),
            label = res.getString(R.string.rush_widget_empty_label),
            danger = false,
          ),
        ),
      )
    }
  }
}

/** Local YYYY-MM-DD key, as getLocalDateString (utils/date.ts) */
fun localDateKey(time: Calendar): String = String.format(
  Locale.US,
  "%04d-%02d-%02d",
  time.get(Calendar.YEAR),
  time.get(Calendar.MONTH) + 1,
  time.get(Calendar.DAY_OF_MONTH),
)

/** Today at this hour, in milliseconds */
fun todayAt(now: Calendar, hour: Int): Long {
  val time = now.clone() as Calendar
  time.set(Calendar.HOUR_OF_DAY, hour)
  time.set(Calendar.MINUTE, 0)
  time.set(Calendar.SECOND, 0)
  time.set(Calendar.MILLISECOND, 0)
  return time.timeInMillis
}

/** Next local midnight, when the next daily challenge comes */
fun nextMidnight(now: Calendar): Long {
  val time = now.clone() as Calendar
  time.add(Calendar.DAY_OF_MONTH, 1)
  time.set(Calendar.HOUR_OF_DAY, 0)
  time.set(Calendar.MINUTE, 0)
  time.set(Calendar.SECOND, 0)
  time.set(Calendar.MILLISECOND, 0)
  return time.timeInMillis
}

/** Saved by the app (RushWidgetModule), read by the widgets: on the phone only */
object WidgetStore {
  private const val PREFERENCES = "rush_hours_widget"
  private const val KEY = "widgetData"

  fun write(context: Context, json: String) {
    context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE).edit().putString(KEY, json).apply()
  }

  fun read(context: Context): WidgetData? =
    WidgetData.parse(context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE).getString(KEY, null))
}
