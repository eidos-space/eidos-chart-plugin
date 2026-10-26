import { formatMetricNumber } from "../aggregate"
import type { ChartConfig, ChartDataItem } from "../types"
import { usePluginI18n } from "../i18n"

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
  const i18n = usePluginI18n()
  const formattedValue = formatMetricNumber(value)

  let label: string = i18n.t("aggregate." + config.aggregate)
  if (config.aggregate !== "Count" && valueFieldName) {
    label = i18n.t("ui.metricLabel", { aggregate: i18n.t("aggregate." + config.aggregate), field: valueFieldName })
  } else if (config.aggregate === "Count") {
    label = i18n.t("ui.totalRecords")
  }

  return (
    <div className="number-card-container">
      <div className="number-card">
        <div className="number-card-label">{label}</div>
        <div className="number-card-value">{formattedValue}</div>
        <div className="number-card-footer">
          {i18n.t(totalRecords === 1 ? "ui.matchingRecord" : "ui.matchingRecords", { count: totalRecords.toLocaleString(i18n.locale) })}
        </div>
      </div>
    </div>
  )
}
