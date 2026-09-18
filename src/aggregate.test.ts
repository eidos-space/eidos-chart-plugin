import { describe, expect, it } from "vitest"
import type { EidosFileFieldInfo, EidosFileRow } from "@eidos.space/eidos-file"
import {
  aggregateRowsClientSide,
  formatMetricNumber,
  toTableAggregateOptions,
} from "./aggregate"
import type { ChartConfig } from "./types"

const sampleFields = [
  {
    id: "f_status",
    name: "Status",
    type: "select",
    tableColumnName: "col_status",
    property: {
      options: [
        { id: "opt_todo", name: "To Do", color: "gray" },
        { id: "opt_done", name: "Done", color: "green" },
      ],
    },
  },
  {
    id: "f_amount",
    name: "Amount",
    type: "number",
    tableColumnName: "col_amount",
  },
  {
    id: "f_date",
    name: "Date",
    type: "date",
    tableColumnName: "col_date",
  },
  {
    id: "f_tags",
    name: "Tags",
    type: "multi-select",
    storageCodec: "json_array",
    tableColumnName: "col_tags",
    property: {
      options: [
        { id: "bug", name: "Bug", color: "red" },
        { id: "feat", name: "Feature", color: "blue" },
      ],
    },
  },
] as unknown as EidosFileFieldInfo[]

const sampleRows = [
  { col_status: "opt_todo", col_amount: 100, col_date: "2026-03-01", col_tags: ["bug"] },
  { col_status: "opt_todo", col_amount: 200, col_date: "2026-03-15", col_tags: ["bug", "feat"] },
  { col_status: "opt_done", col_amount: 50, col_date: "2026-04-10", col_tags: ["feat"] },
  { col_status: null, col_amount: 150, col_date: "2026-04-20", col_tags: [] },
] as unknown as EidosFileRow[]

describe("aggregate", () => {
  it("converts ChartConfig to TableAggregateOptions", () => {
    const config: ChartConfig = {
      type: "Column",
      group: "f_status",
      value: "f_amount",
      aggregate: "Sum",
      date: "Month",
      sort: "Value descending",
      legend: true,
    }
    const options = toTableAggregateOptions(config)
    expect(options).toEqual({
      groupBy: { fieldId: "f_status", dateInterval: "month" },
      metric: { fieldId: "f_amount", op: "sum" },
      sort: "value-desc",
    })
  })

  it("calculates table-level total metric when no group field is chosen", () => {
    const config: ChartConfig = {
      type: "Number",
      group: "",
      value: "f_amount",
      aggregate: "Sum",
      date: "Exact",
      sort: "Label",
      legend: false,
    }
    const result = aggregateRowsClientSide(sampleRows, sampleFields, config)
    expect(result.totalRecords).toBe(4)
    expect(result.items).toEqual([{ key: null, label: "Total", value: 500 }])
  })

  it("calculates grouped sum by status with select option label mapping", () => {
    const config: ChartConfig = {
      type: "Column",
      group: "f_status",
      value: "f_amount",
      aggregate: "Sum",
      date: "Exact",
      sort: "Value descending",
      legend: true,
    }
    const result = aggregateRowsClientSide(sampleRows, sampleFields, config)
    expect(result.totalRecords).toBe(4)
    expect(result.items).toEqual([
      { key: "opt_todo", label: "To Do", value: 300 },
      { key: null, label: "(Empty)", value: 150 },
      { key: "opt_done", label: "Done", value: 50 },
    ])
  })

  it("calculates grouped count by date with month interval", () => {
    const config: ChartConfig = {
      type: "Line",
      group: "f_date",
      value: "",
      aggregate: "Count",
      date: "Month",
      sort: "Label",
      legend: true,
    }
    const result = aggregateRowsClientSide(sampleRows, sampleFields, config)
    expect(result.totalRecords).toBe(4)
    expect(result.items).toEqual([
      { key: "2026-03", label: "2026-03", value: 2 },
      { key: "2026-04", label: "2026-04", value: 2 },
    ])
  })

  it("unpacks multi-select tags properly for count", () => {
    const config: ChartConfig = {
      type: "Bar",
      group: "f_tags",
      value: "",
      aggregate: "Count",
      date: "Exact",
      sort: "Value descending",
      legend: true,
    }
    const result = aggregateRowsClientSide(sampleRows, sampleFields, config)
    expect(result.items).toEqual([
      { key: "bug", label: "Bug", value: 2 },
      { key: "feat", label: "Feature", value: 2 },
      { key: null, label: "(Empty)", value: 1 },
    ])
  })

  it("formats metric numbers nicely", () => {
    expect(formatMetricNumber(1200)).toBe("1,200")
    expect(formatMetricNumber(1234.567)).toBe("1,234.57")
    expect(formatMetricNumber(0)).toBe("0")
  })
})
