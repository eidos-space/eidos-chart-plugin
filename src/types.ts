import type {
  EidosFileFieldInfo,
  EidosFileViewInfo,
} from "@eidos.space/eidos-file"

export type ChartType = "Column" | "Bar" | "Line" | "Donut" | "Number"

export type ChartAggregate = "Count" | "Sum" | "Average" | "Minimum" | "Maximum"

export type ChartDateGrouping = "Exact" | "Day" | "Month" | "Year"

export type ChartSort = "Label" | "Value descending" | "Value ascending"

export interface ChartConfig {
  type: ChartType
  group: string
  value: string
  aggregate: ChartAggregate
  date: ChartDateGrouping
  sort: ChartSort
  legend: boolean
}

export interface ChartDataItem {
  key: unknown
  label: string
  value: number
  color?: string
}

export interface ChartDataResult {
  items: ChartDataItem[]
  totalRecords: number
}

export interface EidosTableSnapshot {
  fields: EidosFileFieldInfo[]
  view: EidosFileViewInfo
}
