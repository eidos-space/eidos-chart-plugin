import type { EidosFileFieldInfo, EidosFileRow } from "@eidos.space/eidos-file"
import {
  createNumericValueReader,
  MetricAccumulator,
  readCell,
  toUtcIso,
} from "./aggregate"
import type { CalendarColorName, CalendarTimezone, ChartConfig } from "./types"

/** Same color names the Eidos interface offers for select options. */
export const CALENDAR_COLORS: Record<CalendarColorName, string> = {
  Blue: "#3b8fe0",
  Green: "#2f9e7e",
  Yellow: "#e6b422",
  Orange: "#e08a2e",
  Red: "#e5534b",
  Pink: "#d9488f",
  Purple: "#8e5fd0",
  Brown: "#937264",
  Gray: "#8f8e8a",
}

export interface CalendarDay {
  value: number
  count: number
  rowId?: string
}

export interface CalendarModel {
  /** Days without data are simply absent, so they render empty. */
  days: Map<string, CalendarDay>
  range?: { min: number; max: number }
  totalRecords: number
  /** Rows whose date could not be read. */
  skipped: number
}

type Rgb = [number, number, number]

function hexToRgb(hex: string): Rgb {
  const h = hex.replace("#", "")
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ]
}

function mix(a: Rgb, b: Rgb, t: number): string {
  const k = Math.max(0, Math.min(1, t))
  const c = a.map((v, i) => Math.round(v + (b[i]! - v) * k))
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`
}

const neutralRgb = (isDark: boolean): Rgb =>
  isDark ? [62, 62, 60] : [232, 232, 230]

function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((channel) => {
    const value = channel / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}

export function contrastText(background: string): string {
  const light = luminance(background) + 0.05
  if (light / (luminance("#1f1f1e") + 0.05) >= 4.5) return "#1f1f1e"
  return 1.05 / light >= 4.5 ? "#ffffff" : "#000000"
}

/** Color for a value on the scale min..max (neutral -> base color). */
export function scaleColor(
  value: number,
  min: number,
  max: number,
  baseColor: string,
  isDark: boolean
): string {
  return mix(neutralRgb(isDark), hexToRgb(baseColor), scaleIntensity(value, min, max))
}

/**
 * How far along neutral -> base color a value is (0..1). The curve is
 * quadratic: low and middle values stay light and only high values get a
 * strong color, so a mid-high value (e.g. 0.67 on a -2..2 scale) is clearly
 * different from the maximum. A linear mapping saturates too early to tell
 * them apart.
 */
function scaleIntensity(value: number, min: number, max: number): number {
  if (max === min) return 0.7
  const fraction = Math.min(1, Math.max(0, (value - min) / (max - min)))
  return 0.1 + 0.9 * fraction ** 2
}

/** CSS gradient for the legend bar, following the same curve as the cells. */
export function scaleGradient(
  min: number,
  max: number,
  baseColor: string,
  isDark: boolean
): string {
  const stops = Array.from({ length: 9 }, (_, i) => {
    const fraction = i / 8
    const color = scaleColor(min + (max - min) * fraction, min, max, baseColor, isDark)
    return `${color} ${fraction * 100}%`
  })
  return `linear-gradient(90deg, ${stops.join(", ")})`
}

const DATE = /^\d{4}-\d{2}-\d{2}$/
const DATETIME = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/

export function dayKeyForInstant(
  date: Date,
  timezone: CalendarTimezone
): string {
  if (timezone === "UTC") return date.toISOString().slice(0, 10)
  const year = String(date.getFullYear()).padStart(4, "0")
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function dayPlacement(raw: unknown, timezone: CalendarTimezone) {
  const value = typeof raw === "string" ? raw.trim() : raw
  const dateOnly = typeof value === "string" && DATE.test(value)
  if (
    typeof value !== "number" &&
    !(typeof value === "string" && (dateOnly || DATETIME.test(value)))
  )
    return null
  const iso = toUtcIso(value)
  if (!iso || !DATE.test(iso.slice(0, 10))) return null
  if (dateOnly && iso.slice(0, 10) !== value) return null
  const date = new Date(iso)
  const key = dateOnly ? iso.slice(0, 10) : dayKeyForInstant(date, timezone)
  return { key, timestamp: date.getTime() }
}

export function dayKeyOf(
  raw: unknown,
  timezone: CalendarTimezone
): string | null {
  return dayPlacement(raw, timezone)?.key ?? null
}

/**
 * Smallest and largest value a Formula can return, when its result is a CASE
 * whose THEN/ELSE branches are all numeric literals (or NULL), e.g. a mood
 * mapping `CASE WHEN ... THEN -2 ... THEN 2 ELSE NULL END`. Anything else is
 * unknown (undefined), because the result depends on the data.
 */
export function formulaValueRange(
  field: EidosFileFieldInfo | undefined
): { min: number; max: number } | undefined {
  const raw = field?.settings?.formula ?? field?.property?.formula
  if (field?.type !== "formula" || typeof raw !== "string") return undefined
  const text = raw.replace(/'[^']*'/g, "''") // ignore text literals
  if (!/\bcase\b/i.test(text) || (text.match(/\bcase\b/gi) ?? []).length > 1) {
    return undefined
  }
  const results = [
    ...text.matchAll(/\b(?:then|else)\s+(.+?)(?=\s+(?:when|else|end)\b|\s*$)/gis),
  ].map((m) => m[1]!.trim())
  const numbers: number[] = []
  for (const result of results) {
    if (/^null$/i.test(result)) continue
    if (!/^[-+]?\d+(?:\.\d+)?$/.test(result)) return undefined
    numbers.push(Number(result))
  }
  return numbers.length
    ? { min: Math.min(...numbers), max: Math.max(...numbers) }
    : undefined
}

type CalendarConfig = Pick<
  ChartConfig,
  "group" | "value" | "aggregate" | "calendarTz"
>

interface RecordOrder {
  rowId: string
  timestamp: number
  createdAt: number
}

function comesAfter(record: RecordOrder, previous: RecordOrder | undefined) {
  if (!previous) return true
  if (record.timestamp !== previous.timestamp) {
    return record.timestamp > previous.timestamp
  }
  if (record.createdAt !== previous.createdAt) {
    return record.createdAt > previous.createdAt
  }
  return record.rowId > previous.rowId
}

export function createCalendarAggregator(
  fields: EidosFileFieldInfo[],
  config: CalendarConfig
) {
  const timezone = config.calendarTz ?? "Local"
  const dateField = fields.find((f) => f.id === config.group)
  const valueField = fields.find((f) => f.id === config.value)
  const idField = fields.find((f) => f.systemRole === "row-id")
  const createdField = fields.find(
    (f) => f.systemRole === "created-time" || f.type === "created-time"
  )
  const useValues = config.aggregate !== "Count"
  const values = createNumericValueReader(valueField, config.value)
  const buckets = new Map<
    string,
    { metric: MetricAccumulator; latest?: RecordOrder }
  >()
  let skipped = 0
  let totalRecords = 0
  // Lowest/highest individual value over every record read (all months).
  let recordedMin = Infinity
  let recordedMax = -Infinity

  function addRows(rows: EidosFileRow[]) {
    totalRecords += rows.length
    for (const row of rows) {
      const placement = dayPlacement(
        readCell(row, dateField, config.group),
        timezone
      )
      if (!placement) {
        skipped++
        continue
      }
      const { key, timestamp } = placement
      const bucket = buckets.get(key) ?? { metric: new MetricAccumulator() }
      const numeric = useValues ? values.read(row) : undefined
      bucket.metric.add(numeric)
      if (numeric !== undefined) {
        recordedMin = Math.min(recordedMin, numeric)
        recordedMax = Math.max(recordedMax, numeric)
      }
      const rowId = row._id ?? readCell(row, idField, "_id")
      if (typeof rowId === "string" && rowId) {
        const creation = readCell(row, createdField, "_created_at")
        const createdAt = dayPlacement(creation, "UTC")?.timestamp ?? -Infinity
        const record = { timestamp, rowId, createdAt }
        if (comesAfter(record, bucket.latest)) bucket.latest = record
      }
      buckets.set(key, bucket)
    }
  }

  function finish(): CalendarModel {
    if (useValues) values.assertReadable(totalRecords - skipped)

    const days = new Map<string, CalendarDay>()
    let min = Infinity
    let max = -Infinity
    for (const [key, { metric, latest }] of buckets) {
      if (useValues && !metric.numericCount) continue
      const value = metric.value(config.aggregate)
      days.set(key, { value, count: metric.count, rowId: latest?.rowId })
      min = Math.min(min, value)
      max = Math.max(max, value)
    }
    // An average, minimum or maximum always lies between the lowest and the
    // highest value the field can take, so the scale spans that whole range:
    // a day is not the darkest just because it is the best one so far. The
    // range comes from a literal Formula when possible, widened by every
    // recorded value. Sum and Count have no such bound, so they use the days.
    let range = days.size ? { min, max } : undefined
    if (
      range &&
      useValues &&
      config.aggregate !== "Sum" &&
      recordedMin <= recordedMax
    ) {
      const possible = formulaValueRange(valueField)
      range = {
        min: Math.min(possible?.min ?? Infinity, recordedMin),
        max: Math.max(possible?.max ?? -Infinity, recordedMax),
      }
    }
    return {
      days,
      range,
      totalRecords,
      skipped,
    }
  }

  return { addRows, finish }
}

export function buildCalendarModel(
  rows: EidosFileRow[],
  fields: EidosFileFieldInfo[],
  config: CalendarConfig
): CalendarModel {
  const aggregator = createCalendarAggregator(fields, config)
  aggregator.addRows(rows)
  return aggregator.finish()
}
