import { useState } from "react"
import { formatMetricNumber } from "../aggregate"
import {
  CALENDAR_COLORS,
  contrastText,
  dayKeyForInstant,
  scaleColor,
  scaleGradient,
  type CalendarModel,
} from "../calendar"
import type { CalendarColorName, CalendarTimezone } from "../types"

type Layout = "Month" | "Week"

// Store civil days at UTC midnight so calendar arithmetic is independent of
// the host's timezone and daylight saving transitions.
function calendarDate(year: number, month: number, day: number): Date {
  const date = new Date(0)
  date.setUTCFullYear(year, month, day)
  return date
}

function addDays(date: Date, count: number): Date {
  return calendarDate(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate() + count
  )
}

function locale(): string {
  return typeof navigator !== "undefined" && navigator.language
    ? navigator.language
    : "en"
}

/** First day of the week as a JS day index (0 = Sunday). */
function firstWeekday(): number {
  try {
    const loc = new Intl.Locale(locale()) as Intl.Locale & {
      weekInfo?: { firstDay: number }
      getWeekInfo?: () => { firstDay: number }
    }
    const info = loc.getWeekInfo?.() ?? loc.weekInfo
    if (info?.firstDay) return info.firstDay % 7
  } catch {
    /* fall through */
  }
  return 0
}

export function CalendarView({
  model,
  timezone,
  color,
  isDark,
  showLegend,
  legendLabel,
  onOpenRecord,
}: {
  model: CalendarModel
  timezone: CalendarTimezone
  color: CalendarColorName
  isDark: boolean
  showLegend: boolean
  legendLabel: string
  onOpenRecord?: (rowId: string) => void
}) {
  const [layout, setLayout] = useState<Layout>("Month")
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const todayKey = dayKeyForInstant(new Date(), timezone)
  const today = new Date(`${todayKey}T00:00:00.000Z`)
  const anchor = selectedDay ?? today

  const start = firstWeekday()
  const fmt = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(locale(), {
      ...options,
      timeZone: "UTC",
      calendar: "gregory",
    })

  // Visible days
  let visible: Array<Date | null>
  let title: string
  if (layout === "Month") {
    const y = anchor.getUTCFullYear()
    const m = anchor.getUTCMonth()
    const first = calendarDate(y, m, 1)
    const lead = (first.getUTCDay() - start + 7) % 7
    const count = calendarDate(y, m + 1, 0).getUTCDate()
    visible = [
      ...Array<null>(lead).fill(null),
      ...Array.from({ length: count }, (_, i) => calendarDate(y, m, i + 1)),
    ]
    while (visible.length % 7 !== 0) visible.push(null)
    title = fmt({ month: "long", year: "numeric" }).format(first)
  } else {
    const weekStart = addDays(anchor, -((anchor.getUTCDay() - start + 7) % 7))
    visible = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
    const f = fmt({ day: "numeric", month: "short", year: "numeric" })
    title =
      typeof f.formatRange === "function"
        ? f.formatRange(visible[0]!, visible[6]!)
        : `${f.format(visible[0]!)} – ${f.format(visible[6]!)}`
  }

  const move = (direction: -1 | 1) =>
    setSelectedDay((selected) => {
      const date = selected ?? today
      return layout === "Month"
        ? calendarDate(date.getUTCFullYear(), date.getUTCMonth() + direction, 1)
        : addDays(date, direction * 7)
    })

  const weekdayFormat = fmt({ weekday: "short" })
  const weekdays = Array.from(
    { length: 7 },
    (_, i) => weekdayFormat.format(calendarDate(2026, 0, 4 + ((start + i) % 7))) // 2026-01-04 is a Sunday
  )
  const dayFormat = fmt({ dateStyle: "full" })
  const baseColor = CALENDAR_COLORS[color] ?? CALENDAR_COLORS.Blue
  const { range } = model
  const skippedMessage = model.skipped
    ? `${model.skipped.toLocaleString()} without a readable date`
    : ""

  return (
    <div className={`cal-root${layout === "Week" ? " cal-week" : ""}`}>
      <div className="cal-toolbar">
        <div className="cal-title" aria-live="polite">
          {title}
        </div>
        <div className="cal-segment" role="group" aria-label="Calendar layout">
          {(["Month", "Week"] as const).map((l) => (
            <button
              key={l}
              type="button"
              className={`chart-btn${layout === l ? " cal-active" : ""}`}
              aria-pressed={layout === l}
              onClick={() => setLayout(l)}
            >
              {l}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="chart-btn"
          onClick={() => setSelectedDay(null)}
        >
          Today
        </button>
        <button
          type="button"
          className="chart-btn"
          onClick={() => move(-1)}
          aria-label={layout === "Month" ? "Previous month" : "Previous week"}
        >
          ‹
        </button>
        <button
          type="button"
          className="chart-btn"
          onClick={() => move(1)}
          aria-label={layout === "Month" ? "Next month" : "Next week"}
        >
          ›
        </button>
      </div>

      <div className="cal-grid" role="group" aria-label={title}>
        {weekdays.map((w, i) => (
          <div className="cal-dow" key={`dow-${i}`}>
            {w}
          </div>
        ))}
        {visible.map((date, i) => {
          if (!date)
            return <div className="cal-cell cal-cell-blank" key={`b-${i}`} />
          const key = dayKeyForInstant(date, "UTC")
          const info = model.days.get(key)
          const rowId = info?.rowId
          const label = info && formatMetricNumber(info.value)
          const background =
            info && range
              ? scaleColor(info.value, range.min, range.max, baseColor, isDark)
              : undefined
          const summary = info
            ? `${key} · ${label} (${info.count} entries)`
            : key
          const cellProps = {
            className: `cal-cell${info ? " cal-cell-filled" : ""}${key === todayKey ? " cal-cell-today" : ""}`,
            style: background
              ? { background, color: contrastText(background) }
              : undefined,
            title: summary,
            "aria-current": key === todayKey ? ("date" as const) : undefined,
          }
          const children = (
            <>
              <span className="cal-daynum">{date.getUTCDate()}</span>
              {info && <span className="cal-label">{label}</span>}
            </>
          )
          return rowId && onOpenRecord ? (
            <button
              {...cellProps}
              type="button"
              key={key}
              className={`${cellProps.className} cal-cell-clickable`}
              aria-label={`Open latest record for ${dayFormat.format(date)}, value ${label}`}
              onClick={() => onOpenRecord(rowId)}
            >
              {children}
            </button>
          ) : (
            <div key={key} {...cellProps}>
              {children}
            </div>
          )
        })}
      </div>

      {showLegend && range && (
        <div className="cal-legend">
          <div className="cal-scale">
            <span className="cal-legend-text">
              {formatMetricNumber(range.min)}
            </span>
            <span
              className="cal-gradient"
              style={{
                background: scaleGradient(range.min, range.max, baseColor, isDark),
              }}
            />
            <span className="cal-legend-text">
              {formatMetricNumber(range.max)}
            </span>
          </div>
          <span className="cal-legend-text cal-legend-field">
            {legendLabel}
          </span>
        </div>
      )}
      {!model.days.size && (
        <div className="cal-message" role="status">
          {model.totalRecords === 0
            ? "No matching records."
            : "No data to display for these dates."}
        </div>
      )}
      {skippedMessage && <div className="cal-message">{skippedMessage}</div>}
    </div>
  )
}
