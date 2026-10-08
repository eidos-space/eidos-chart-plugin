import { useEffect, useMemo, useRef, useState } from "react"
import { createRoot } from "react-dom/client"
import type {
  Mount,
  EidosTable,
  EidosTableSnapshot,
} from "@eidos.space/plugin-sdk"
import { exportChartPng, type ChartHostUI } from "./export"
import { aggregateRowsClientSide, toTableAggregateOptions } from "./aggregate"
import { ChartCanvas } from "./charts/chart-canvas"
import { NumberCard } from "./charts/number-card"
import type { ChartConfig, ChartDataResult } from "./types"
import "./style.css"

function initialConfig(snapshot: EidosTableSnapshot): ChartConfig {
  const saved = snapshot.view.properties?.plugin as
    | Partial<ChartConfig>
    | undefined
  return {
    type: saved?.type ?? "Column",
    group: saved?.group ?? "",
    value: saved?.value ?? "",
    aggregate: saved?.aggregate ?? "Count",
    date: saved?.date ?? "Exact",
    sort: saved?.sort ?? "Label",
    legend: saved?.legend ?? true,
  }
}

function useColorScheme(): boolean {
  const [isDark, setIsDark] = useState(() => {
    if (typeof document === "undefined") return false
    const hostScheme = getComputedStyle(document.documentElement)
      .getPropertyValue("--eidos-color-scheme")
      .trim()
    if (hostScheme) return hostScheme === "dark"
    return window.matchMedia("(prefers-color-scheme: dark)").matches
  })

  useEffect(() => {
    const check = () => {
      const hostScheme = getComputedStyle(document.documentElement)
        .getPropertyValue("--eidos-color-scheme")
        .trim()
      if (hostScheme) {
        setIsDark(hostScheme === "dark")
      } else {
        setIsDark(window.matchMedia("(prefers-color-scheme: dark)").matches)
      }
    }

    const observer = new MutationObserver(check)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["style", "class", "data-theme"],
    })

    const mql = window.matchMedia("(prefers-color-scheme: dark)")
    mql.addEventListener("change", check)

    return () => {
      observer.disconnect()
      mql.removeEventListener("change", check)
    }
  }, [])

  return isDark
}

function ChartView({
  table,
  ui,
  embedded,
}: {
  table: EidosTable
  ui: ChartHostUI
  embedded: boolean
}) {
  const chartRoot = useRef<HTMLElement>(null)
  const exportBusy = useRef(false)
  const active = useRef(true)
  const [exporting, setExporting] = useState(false)
  const [exportStatus, setExportStatus] = useState("")
  useEffect(() => {
    active.current = true
    return () => {
      active.current = false
    }
  }, [])
  const isDark = useColorScheme()
  const [snapshot, setSnapshot] = useState<EidosTableSnapshot | null>(null)
  const [config, setConfig] = useState<ChartConfig>({
    type: "Column",
    group: "",
    value: "",
    aggregate: "Count",
    date: "Exact",
    sort: "Label",
    legend: true,
  })
  const [data, setData] = useState<ChartDataResult>({
    items: [],
    totalRecords: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [revision, setRevision] = useState(0)

  // Listen to invalidation events from the table
  useEffect(() => {
    const observation = table.watch(() => setRevision((v) => v + 1))
    return () => observation.dispose()
  }, [table])

  // Read snapshot & config
  useEffect(() => {
    let active = true
    void table
      .readContext()
      .then((val) => {
        if (active) {
          setSnapshot(val)
          setConfig(initialConfig(val))
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : String(err))
        }
      })
    return () => {
      active = false
    }
  }, [table, revision])

  // Fetch or aggregate data
  useEffect(() => {
    if (!snapshot) return
    let active = true
    setLoading(true)
    setError("")

    async function loadData() {
      // 1. Try host-level table.aggregate
      if (typeof table.aggregate === "function") {
        try {
          const options = toTableAggregateOptions(config)
          const result = await table.aggregate(options)
          if (active) {
            setData(result)
            setLoading(false)
          }
          return
        } catch (cause) {
          // If unsupported, fall through to client-side batch fetch
          console.warn("Host table.aggregate unavailable, falling back:", cause)
        }
      }

      // 2. Client-side fallback batch scan
      try {
        const allRows: any[] = []
        let offset = 0
        const limit = 1000
        const MAX_ROWS = 50000

        while (offset < MAX_ROWS) {
          const page = await table.readRows({ offset, limit })
          allRows.push(...page.rows)
          if (page.rows.length < limit || allRows.length >= (page.total ?? 0)) {
            break
          }
          offset += page.rows.length
        }

        if (active) {
          const result = aggregateRowsClientSide(
            allRows,
            snapshot?.fields ?? [],
            config
          )
          setData(result)
          setLoading(false)
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : String(err))
          setLoading(false)
        }
      }
    }

    void loadData()

    return () => {
      active = false
    }
  }, [table, snapshot, config, revision])

  const groupField = useMemo(
    () => snapshot?.fields.find((f) => f.id === config.group),
    [snapshot, config.group]
  )
  const valueField = useMemo(
    () => snapshot?.fields.find((f) => f.id === config.value),
    [snapshot, config.value]
  )

  const isConfigured = useMemo(() => {
    if (config.type === "Number") {
      if (config.aggregate !== "Count" && !config.value) return false
      return true
    }
    if (!config.group) return false
    if (config.aggregate !== "Count" && !config.value) return false
    return true
  }, [config])

  const exportImage = async () => {
    if (exportBusy.current || !ui.exportFile) return
    exportBusy.current = true
    setExporting(true)
    setExportStatus("")
    try {
      const canvas =
        chartRoot.current?.querySelector<HTMLCanvasElement>(
          ".chart-canvas-container canvas"
        ) ?? null
      const status = await exportChartPng(
        canvas,
        ui.exportFile,
        `chart-${Date.now()}.png`
      )
      if (active.current) setExportStatus(status)
    } catch (cause) {
      if (active.current)
        setExportStatus(
          `Export failed: ${cause instanceof Error ? cause.message : String(cause)}`
        )
    } finally {
      exportBusy.current = false
      if (active.current) setExporting(false)
    }
  }

  return (
    <main className={`chart-root${embedded ? " chart-embedded" : ""}`} ref={chartRoot}>
      {!embedded && (
        <header className="chart-header">
          <div className="chart-title-area">
            <h1 className="chart-title">
              {config.type === "Number"
                ? "Metric"
                : `${groupField?.name ?? "Items"} by ${config.aggregate}`}
            </h1>
            <span className="chart-record-count">
              · {data.totalRecords.toLocaleString()}{" "}
              {data.totalRecords === 1 ? "record" : "records"}
            </span>
          </div>
          <div className="chart-actions">
            {config.type !== "Number" &&
              isConfigured &&
              data.items.length > 0 && (
                <button
                  className="chart-btn"
                  onClick={exportImage}
                  disabled={exporting || loading || !ui.exportFile}
                  title={
                    ui.exportFile
                      ? "Export as PNG image"
                      : "PNG export requires an Eidos host with file export support"
                  }
                >
                  {exporting ? "Exporting…" : "Export PNG"}
                </button>
              )}
            <button
              className="chart-btn"
              onClick={() => setRevision((v) => v + 1)}
              title="Refresh chart"
            >
              ↻
            </button>
          </div>
        </header>
      )}
      <div role="status" aria-live="polite" className="chart-export-status">
        {exportStatus ||
          (!ui.exportFile && config.type !== "Number"
            ? "PNG export requires an Eidos host with file export support."
            : "")}
      </div>

      {error && (
        <div className="chart-error" role="alert">
          <span>{error}</span>
          <button onClick={() => setRevision((v) => v + 1)}>Retry</button>
        </div>
      )}

      <div className="chart-content">
        {!isConfigured ? (
          <div className="chart-empty">
            <svg
              className="chart-empty-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M3 3v18h18" />
              <path d="M7 16v-5" />
              <path d="M12 16V7" />
              <path d="M17 16v-8" />
            </svg>
            <div className="chart-empty-title">Configure Chart</div>
            <div className="chart-empty-hint">
              {!config.group && config.type !== "Number"
                ? "Select a 'Group by' field in the View settings menu above."
                : "Select a numeric 'Value field' in View settings to calculate."}
            </div>
          </div>
        ) : loading && data.items.length === 0 ? (
          <div className="chart-loading">Loading chart data…</div>
        ) : data.totalRecords === 0 ? (
          <div className="chart-empty">
            <div className="chart-empty-title">No Records</div>
            <div className="chart-empty-hint">
              There are no matching records for the current filters.
            </div>
          </div>
        ) : config.type === "Number" ? (
          <NumberCard
            item={data.items[0]}
            totalRecords={data.totalRecords}
            config={config}
            valueFieldName={valueField?.name}
          />
        ) : (
          <ChartCanvas items={data.items} config={config} isDark={isDark} />
        )}
      </div>
    </main>
  )
}

const mount: Mount = (ctx, element) => {
  const table = ctx.capabilities.eidos?.table
  if (!table) {
    throw new Error("Chart plugin requires a table view")
  }
  const root = createRoot(element)
  const presentation = ctx.presentation
  root.render(
    <ChartView
      table={table}
      ui={ctx.capabilities.ui}
      embedded={presentation?.mode === "embedded"}
    />
  )
  return {
    dispose: () => root.unmount(),
  }
}

export default mount
