import { describe, expect, it } from "vitest"
import type { EidosFileFieldInfo, EidosFileRow } from "@eidos.space/eidos-file"
import type { ChartConfig } from "./types"
import {
  buildCalendarModel,
  CALENDAR_COLORS,
  contrastText,
  dayKeyForInstant,
  dayKeyOf,
  scaleColor,
  scaleGradient,
} from "./calendar"

const f = (o: Record<string, unknown>) => o as unknown as EidosFileFieldInfo
const rowsOf = (r: unknown[]) => r as unknown as EidosFileRow[]

const dateField = f({
  id: "f_dt",
  name: "Date/Time",
  type: "datetime",
  tableColumnName: "dt",
})
const numField = f({
  id: "f_n",
  name: "Mood Number Values",
  type: "formula",
  tableColumnName: "n",
})
const cfg = (aggregate: ChartConfig["aggregate"], value = "f_n") => ({
  group: "f_dt",
  value,
  aggregate,
  calendarTz: "UTC" as const,
})

describe("colored calendar", () => {
  it("averages the numeric value per day and leaves days without entries empty", () => {
    const rows = rowsOf([
      { _id: "a", dt: "2026-11-17T18:17:00.000Z", n: 2 },
      { _id: "b", dt: "2026-11-17T03:00:00.000Z", n: "2" },
      { _id: "c", dt: "2026-11-16T12:00:00.000Z", n: 1n },
      { _id: "d", dt: "2026-11-16T18:00:00.000Z", n: -1 },
    ])
    const m = buildCalendarModel(rows, [dateField, numField], cfg("Average"))
    // The scale spans the recorded values (-1..2), not just the daily averages.
    expect(m.range).toEqual({ min: -1, max: 2 })
    expect(m.days.get("2026-11-17")).toMatchObject({
      value: 2,
      count: 2,
      rowId: "a",
    })
    expect(m.days.get("2026-11-16")).toMatchObject({
      value: 0,
      count: 2,
      rowId: "d",
    })
    expect(m.days.has("2026-11-18")).toBe(false)
  })

  it("applies Sum, Minimum, Maximum and Count", () => {
    const rows = rowsOf([
      { dt: "2026-11-16T10:00:00Z", n: 3 },
      { dt: "2026-11-16T11:00:00Z", n: 5 },
      { dt: "2026-11-16T12:00:00Z", n: null },
    ])
    const value = (agg: ChartConfig["aggregate"]) =>
      buildCalendarModel(rows, [dateField, numField], cfg(agg)).days.get(
        "2026-11-16"
      )?.value
    expect(value("Sum")).toBe(8)
    expect(value("Minimum")).toBe(3)
    expect(value("Maximum")).toBe(5)
    expect(value("Count")).toBe(3)
  })

  it("leaves a day empty when it has entries but no numeric value", () => {
    const rows = rowsOf([
      { dt: "2026-11-16T10:00:00Z", n: null },
      { dt: "2026-11-17T10:00:00Z", n: 4 },
    ])
    const m = buildCalendarModel(rows, [dateField, numField], cfg("Average"))
    expect(m.days.has("2026-11-16")).toBe(false)
    expect(m.days.has("2026-11-17")).toBe(true)
  })

  it("Count needs no value field", () => {
    const rows = rowsOf([
      { dt: "2026-11-16T10:00:00Z" },
      { dt: "2026-11-17T10:00:00Z" },
      { dt: "2026-11-17T11:00:00Z" },
    ])
    const m = buildCalendarModel(rows, [dateField], cfg("Count", ""))
    expect(m.days.get("2026-11-17")?.value).toBe(2)
    expect(m.range).toEqual({ min: 1, max: 2 })
  })

  it("opens the latest date-only record independently of view sorting", () => {
    const fields = [
      { ...dateField, type: "date" as const },
      f({
        id: "created",
        type: "created-time",
        tableColumnName: "created",
        systemRole: "created-time",
      }),
    ]
    const rows = rowsOf([
      { _id: "a", dt: "2026-11-17", created: "2026-11-17T12:00:00Z" },
      { _id: "b", dt: "2026-11-17", created: "2026-11-17T07:00:00Z" },
    ])
    expect(
      buildCalendarModel(rows, fields, cfg("Count")).days.get("2026-11-17")
        ?.rowId
    ).toBe("a")
    expect(
      buildCalendarModel([...rows].reverse(), fields, cfg("Count")).days.get(
        "2026-11-17"
      )?.rowId
    ).toBe("a")
  })

  it("uses the same normalized datetime for record order and day grouping", () => {
    const rows = rowsOf([
      { _id: "later", dt: "2026-11-17T23:20:00Z" },
      { _id: "earlier", dt: "2026-11-17 23:15:00" },
    ])
    const model = buildCalendarModel(rows, [dateField], cfg("Count"))
    expect(model.days.get("2026-11-17")?.rowId).toBe("later")
  })

  it("reports an error instead of an empty calendar when values are unreadable", () => {
    const text = [{ dt: "2026-11-16T10:00:00Z", n: "Great" }]
    expect(() =>
      buildCalendarModel(rowsOf(text), [dateField, numField], cfg("Average"))
    ).toThrow(/Mood Number Values/)
    const missing = [{ dt: "2026-11-16T10:00:00Z" }]
    expect(() =>
      buildCalendarModel(rowsOf(missing), [dateField, numField], cfg("Average"))
    ).toThrow(/did not return/)
    const empty = [{ dt: "2026-11-16T10:00:00Z", n: null }]
    expect(
      buildCalendarModel(rowsOf(empty), [dateField, numField], cfg("Average"))
        .days.size
    ).toBe(0)
  })

  it("skips rows without a readable date", () => {
    const rows = rowsOf([
      { dt: null, n: 1 },
      { dt: "nope", n: 1 },
      { dt: "2026-11-16T10:00:00Z", n: 1 },
    ])
    const m = buildCalendarModel(rows, [dateField, numField], cfg("Sum"))
    expect(m.skipped).toBe(2)
    expect(m.days.size).toBe(1)
  })

  it("reports skipped rows without a value-field error when there is no readable date", () => {
    const rows = rowsOf([
      { dt: null, n: 42 },
      { dt: "2026-02-30", n: 5 },
    ])
    expect(
      buildCalendarModel(rows, [dateField, numField], cfg("Average"))
    ).toEqual({
      days: new Map(),
      range: undefined,
      totalRecords: 2,
      skipped: 2,
    })
  })

  it("assigns days by UTC or by local time", () => {
    const raw = "2026-11-17T02:30:00.000Z"
    expect(dayKeyOf(raw, "UTC")).toBe("2026-11-17")
    const d = new Date(raw)
    const local = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    expect(dayKeyOf(raw, "Local")).toBe(local)
    expect(dayKeyForInstant(d, "Local")).toBe(local)
    expect(dayKeyForInstant(d, "UTC")).toBe("2026-11-17")
    expect(dayKeyOf("2026-11-17", "Local")).toBe("2026-11-17")
    expect(dayKeyOf("2026-11-17 23:30:00", "UTC")).toBe("2026-11-17")
    expect(dayKeyOf("hello", "UTC")).toBeNull()
    expect(dayKeyOf(1e20, "UTC")).toBeNull()
  })

  it("scales from neutral to the base color with readable text", () => {
    expect(scaleColor(10, 0, 10, CALENDAR_COLORS.Blue, false)).toBe(
      CALENDAR_COLORS.Blue
    )
    expect(scaleColor(10, 0, 10, CALENDAR_COLORS.Green, true)).toBe(
      CALENDAR_COLORS.Green
    )
    expect(scaleColor(5, 5, 5, CALENDAR_COLORS.Blue, false)).not.toBe(
      CALENDAR_COLORS.Blue
    )
    expect(contrastText(CALENDAR_COLORS.Blue)).toBe("#1f1f1e")
    expect(contrastText("#ffffff")).toBe("#1f1f1e")
    expect(contrastText("#000000")).toBe("#ffffff")
  })

  describe("scale range", () => {
    const moodFormula = `CASE
      WHEN "Mood" = 'Awful' THEN -2
      WHEN "Mood" = 'Bad' THEN -1
      WHEN "Mood" = 'Okay' THEN 0
      WHEN "Mood" = 'Good' THEN 1
      WHEN "Mood" = 'Great' THEN 2
      ELSE NULL
    END`
    const mood = (formula?: string) =>
      f({
        id: "f_n",
        name: "Mood Number Values",
        type: "formula",
        tableColumnName: "n",
        settings: formula === undefined ? undefined : { formula },
      })

    it("reads the possible range from a literal CASE formula", () => {
      // Only 0 and 1 were ever recorded, but the field can go from -2 to 2.
      const rows = rowsOf([
        { dt: "2026-11-16T10:00:00Z", n: 1 },
        { dt: "2026-11-17T10:00:00Z", n: 0 },
      ])
      const m = buildCalendarModel(rows, [dateField, mood(moodFormula)], cfg("Average"))
      expect(m.range).toEqual({ min: -2, max: 2 })
      expect(m.days.get("2026-11-16")?.value).toBe(1)
      // The best day is NOT the darkest color.
      const blue = CALENDAR_COLORS.Blue
      expect(scaleColor(1, -2, 2, blue, false)).not.toBe(blue)
    })

    it("uses every recorded value when the formula range is unknown", () => {
      const rows = rowsOf([
        { dt: "2026-11-15T10:00:00Z", n: -2 },
        { dt: "2026-11-15T11:00:00Z", n: 2 },
        { dt: "2026-11-16T10:00:00Z", n: 1 },
        { dt: "2026-11-17T10:00:00Z", n: 0 },
      ])
      for (const field of [
        mood(), // formula text not exposed
        mood(`"Mood" * 2`), // not a literal CASE
        mood(`CASE WHEN "Mood" = 'Great' THEN "Score" ELSE 0 END`), // non-literal result
      ]) {
        const m = buildCalendarModel(rows, [dateField, field], cfg("Average"))
        expect(m.range).toEqual({ min: -2, max: 2 })
      }
    })

    it("applies to Minimum and Maximum but not to Sum or Count", () => {
      const rows = rowsOf([
        { dt: "2026-11-16T10:00:00Z", n: 1 },
        { dt: "2026-11-16T11:00:00Z", n: 2 },
        { dt: "2026-11-17T10:00:00Z", n: 4 },
        { dt: "2026-11-18T10:00:00Z", n: 9 },
      ])
      const range = (agg: ChartConfig["aggregate"]) =>
        buildCalendarModel(rows, [dateField, numField], cfg(agg)).range
      expect(range("Average")).toEqual({ min: 1, max: 9 })
      expect(range("Minimum")).toEqual({ min: 1, max: 9 })
      expect(range("Maximum")).toEqual({ min: 1, max: 9 })
      expect(range("Sum")).toEqual({ min: 3, max: 9 }) // days only
      expect(range("Count")).toEqual({ min: 1, max: 2 }) // days only
    })

    it("widens the formula range if a recorded value falls outside it", () => {
      const rows = rowsOf([{ dt: "2026-11-16T10:00:00Z", n: 5 }])
      const m = buildCalendarModel(rows, [dateField, mood(moodFormula)], cfg("Average"))
      expect(m.range).toEqual({ min: -2, max: 5 })
    })

    it("ignores text literals and NULL when reading the formula", () => {
      const rows = rowsOf([{ dt: "2026-11-16T10:00:00Z", n: 0 }])
      const field = mood(`CASE WHEN "Tag" = 'THEN 99' THEN -1 ELSE 1 END`)
      expect(buildCalendarModel(rows, [dateField, field], cfg("Average")).range).toEqual({
        min: -1,
        max: 1,
      })
    })
  })

  describe("color curve", () => {
    const blue = CALENDAR_COLORS.Blue
    const red = (hex: string) => parseInt(hex.slice(1, 3), 16)
    // Share of the way from the neutral color to the base color (red channel).
    const share = (value: number) => {
      const base = red(blue)
      const light = 232 // neutral light gray used for empty/min tint
      return (light - red(scaleColor(value, -2, 2, blue, false))) / (light - base)
    }

    it("keeps mid-high values clearly lighter than the maximum", () => {
      expect(share(2)).toBeCloseTo(1, 2)
      expect(share(2 / 3)).toBeGreaterThan(0.4)
      expect(share(2 / 3)).toBeLessThan(0.6)
      expect(share(0)).toBeLessThan(0.4)
      expect(share(-1.5)).toBeLessThan(0.2)
      // The gap between 0.67 and +2 is large (it was about a quarter before).
      expect(share(2) - share(2 / 3)).toBeGreaterThan(0.4)
    })

    it("is monotonic and clamps values outside the range", () => {
      const values = [-2, -1, 0, 1, 2].map(share)
      expect([...values].sort((a, b) => a - b)).toEqual(values)
      expect(scaleColor(9, -2, 2, blue, false)).toBe(scaleColor(2, -2, 2, blue, false))
      expect(scaleColor(-9, -2, 2, blue, false)).toBe(scaleColor(-2, -2, 2, blue, false))
    })

    it("draws the legend with the same curve as the cells", () => {
      const gradient = scaleGradient(-2, 2, blue, false)
      expect(gradient).toContain(scaleColor(2, -2, 2, blue, false))
      expect(gradient).toContain(scaleColor(0, -2, 2, blue, false))
      expect(gradient.match(/%/g)).toHaveLength(9)
    })
  })
})
