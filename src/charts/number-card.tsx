import { formatMetricNumber } from "../aggregate"
import type { ChartConfig, ChartDataItem } from "../types"

export function NumberCard({
  item,
  totalRecords,
  config,
  valueFieldName,
}: {
  item?: ChartDataItem
  totalRecords: number
  config: ChartConfig
  valueFieldName?: string
}) {
  const value = item?.value ?? 0
  const formattedValue = formatMetricNumber(value)

  let label: string = config.aggregate
  if (config.aggregate !== "Count" && valueFieldName) {
    label = `${config.aggregate} of ${valueFieldName}`
  } else if (config.aggregate === "Count") {
    label = "Total Records"
  }

  return (
    <div className="number-card-container">
      <div className="number-card">
        <div className="number-card-label">{label}</div>
        <div className="number-card-value">{formattedValue}</div>
        <div className="number-card-footer">
          {totalRecords.toLocaleString()} matching {totalRecords === 1 ? "record" : "records"}
        </div>
      </div>
    </div>
  )
}
