import type {
  EidosFileFieldInfo,
  EidosFileRow,
} from "@eidos.space/eidos-file"
import type {
  TableAggregateDateInterval,
  TableAggregateMetric,
  TableAggregateOptions,
} from "@eidos.space/plugin-sdk"
import type {
  ChartAggregate,
  ChartConfig,
  ChartDataItem,
  ChartDataResult,
} from "./types"

export const NOTION_COLORS_LIGHT = [
  "#2383e2", // blue
  "#0f7b6c", // green
  "#dfab01", // yellow
  "#d9730d", // orange
  "#e03e3e", // red
  "#6940a5", // purple
  "#ad1a72", // pink
  "#64473a", // brown
  "#4d5566", // slate
  "#0b6e99", // cyan
]

export const NOTION_COLORS_DARK = [
  "#529cca", // blue
  "#4dab9a", // green
  "#ffdc49", // yellow
  "#ffa344", // orange
  "#ff7369", // red
  "#9a6dd7", // purple
  "#e255a1", // pink
  "#937264", // brown
  "#979ca6", // slate
  "#529cca", // cyan
]

export function getChartColor(index: number, isDark: boolean): string {
  const palette = isDark ? NOTION_COLORS_DARK : NOTION_COLORS_LIGHT
  return palette[index % palette.length]!
}

export function getChartPalette(count: number, isDark: boolean): string[] {
  const palette = isDark ? NOTION_COLORS_DARK : NOTION_COLORS_LIGHT
  const colors: string[] = []
  for (let i = 0; i < count; i++) {
    colors.push(palette[i % palette.length]!)
  }
  return colors
}

export function toTableAggregateOptions(
  config: ChartConfig
): TableAggregateOptions {
  const opMap: Record<ChartAggregate, TableAggregateMetric> = {
    Count: "count",
    Sum: "sum",
    Average: "average",
    Minimum: "min",
    Maximum: "max",
  }
  const intervalMap: Record<
    ChartConfig["date"],
    TableAggregateDateInterval
  > = {
    Exact: "exact",
    Day: "day",
    Month: "month",
    Year: "year",
  }
  const sortMap: Record<
    ChartConfig["sort"],
    "label" | "value-desc" | "value-asc"
  > = {
    Label: "label",
    "Value descending": "value-desc",
    "Value ascending": "value-asc",
  }

  return {
    groupBy: config.group
      ? {
          fieldId: config.group,
          dateInterval: intervalMap[config.date] ?? "exact",
        }
      : undefined,
    metric: {
      fieldId: config.value || undefined,
      op: opMap[config.aggregate] ?? "count",
    },
    sort: sortMap[config.sort] ?? "label",
  }
}

export function formatMetricNumber(value: number): string {
  if (Number.isInteger(value)) {
    return value.toLocaleString()
  }
  return Number(value.toFixed(2)).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

function formatDateKey(raw: string, interval: ChartConfig["date"]): string {
  if (interval === "Exact") return raw
  const trimmed = raw.trim()
  if (interval === "Year") {
    return trimmed.slice(0, 4)
  }
  if (interval === "Month") {
    return trimmed.slice(0, 7)
  }
  if (interval === "Day") {
    return trimmed.slice(0, 10)
  }
  return raw
}

/**
 * Client-side aggregation engine used for local fallback or testing.
 */
export function aggregateRowsClientSide(
  rows: EidosFileRow[],
  fields: EidosFileFieldInfo[],
  config: ChartConfig
): ChartDataResult {
  const groupField = fields.find((f) => f.id === config.group)
  const valueField = fields.find((f) => f.id === config.value)

  const groupCol = groupField?.tableColumnName ?? config.group
  const valueCol = valueField?.tableColumnName ?? config.value

  const optionsMap = new Map<string, string>()
  if (
    (groupField?.type === "select" || groupField?.type === "multi-select") &&
    Array.isArray(groupField.property?.options)
  ) {
    for (const opt of groupField.property.options as Array<{
      id: string
      name: string
    }>) {
      optionsMap.set(opt.id, opt.name)
    }
  }

  // Single metric across all rows
  if (!groupField) {
    let result = 0
    if (config.aggregate === "Count") {
      result = rows.length
    } else {
      const numbers: number[] = []
      for (const row of rows) {
        const raw = row[valueCol]
        if (typeof raw === "number" && Number.isFinite(raw)) {
          numbers.push(raw)
        }
      }
      if (config.aggregate === "Sum") {
        result = numbers.reduce((a, b) => a + b, 0)
      } else if (config.aggregate === "Average") {
        result = numbers.length
          ? numbers.reduce((a, b) => a + b, 0) / numbers.length
          : 0
      } else if (config.aggregate === "Minimum") {
        result = numbers.length ? Math.min(...numbers) : 0
      } else if (config.aggregate === "Maximum") {
        result = numbers.length ? Math.max(...numbers) : 0
      }
    }
    return {
      items: [{ key: null, label: "Total", value: result }],
      totalRecords: rows.length,
    }
  }

  // Grouped aggregation
  type GroupAccumulator = {
    key: unknown
    label: string
    values: number[]
    count: number
  }
  const groups = new Map<string, GroupAccumulator>()

  const isList =
    groupField.storageCodec === "json_array" ||
    groupField.storageCodec === "relation"

  for (const row of rows) {
    const rawGroupVal = row[groupCol]
    const rawNumVal = row[valueCol]
    const numeric =
      typeof rawNumVal === "number" && Number.isFinite(rawNumVal)
        ? rawNumVal
        : undefined

    let keys: unknown[] = []
    if (isList) {
      if (Array.isArray(rawGroupVal)) {
        keys = rawGroupVal
      } else if (typeof rawGroupVal === "string" && rawGroupVal.startsWith("[")) {
        try {
          keys = JSON.parse(rawGroupVal)
        } catch {
          keys = [rawGroupVal]
        }
      } else if (rawGroupVal !== null && rawGroupVal !== undefined) {
        keys = [rawGroupVal]
      }
      if (keys.length === 0) {
        keys = [null]
      }
    } else {
      keys = [rawGroupVal]
    }

    for (const k of keys) {
      let bucketKey = k
      if (typeof k === "string" && groupField.type === "date") {
        bucketKey = formatDateKey(k, config.date)
      }
      const stringKey =
        bucketKey === null || bucketKey === undefined ? "__null__" : String(bucketKey)

      let accum = groups.get(stringKey)
      if (!accum) {
        let label = ""
        if (bucketKey === null || bucketKey === undefined || bucketKey === "") {
          label = "(Empty)"
        } else if (groupField.type === "checkbox") {
          label = bucketKey === 1 || bucketKey === true ? "Checked" : "Unchecked"
        } else if (typeof bucketKey === "string" && optionsMap.has(bucketKey)) {
          label = optionsMap.get(bucketKey)!
        } else {
          label = String(bucketKey)
        }
        accum = { key: bucketKey, label, values: [], count: 0 }
        groups.set(stringKey, accum)
      }

      accum.count++
      if (numeric !== undefined) {
        accum.values.push(numeric)
      }
    }
  }

  const items: ChartDataItem[] = []
  for (const group of groups.values()) {
    let value = 0
    if (config.aggregate === "Count") {
      value = group.count
    } else if (config.aggregate === "Sum") {
      value = group.values.reduce((a, b) => a + b, 0)
    } else if (config.aggregate === "Average") {
      value = group.values.length
        ? group.values.reduce((a, b) => a + b, 0) / group.values.length
        : 0
    } else if (config.aggregate === "Minimum") {
      value = group.values.length ? Math.min(...group.values) : 0
    } else if (config.aggregate === "Maximum") {
      value = group.values.length ? Math.max(...group.values) : 0
    }
    items.push({
      key: group.key,
      label: group.label,
      value,
    })
  }

  // Sort
  if (config.sort === "Value descending") {
    items.sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
  } else if (config.sort === "Value ascending") {
    items.sort((a, b) => a.value - b.value || a.label.localeCompare(b.label))
  } else {
    items.sort((a, b) => a.label.localeCompare(b.label))
  }

  return {
    items,
    totalRecords: rows.length,
  }
}
