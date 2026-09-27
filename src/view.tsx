import { useEffect, useMemo, useState } from "react"
import { createRoot } from "react-dom/client"
import type { Mount, TableContext, TableViewSnapshot } from "@eidos.space/plugin-sdk"
import {
  aggregateRowsClientSide,
  toTableAggregateOptions,
} from "./aggregate"
import { ChartCanvas } from "./charts/chart-canvas"
import { NumberCard } from "./charts/number-card"
import type { ChartConfig, ChartDataResult } from "./types"
import "./style.css"

function initialConfig(snapshot: TableViewSnapshot): ChartConfig {
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

function ChartView({ table }: { table: TableContext }) {
  const isDark = useColorScheme()
  const [snapshot, setSnapshot] = useState<TableViewSnapshot | null>(null)
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
    const observation = table.observe(() => setRevision((v) => v + 1))
    return () => observation.dispose()
  }, [table])

  // Read snapshot & config
  useEffect(() => {
    let active = true
    void table
      .read()
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
          const page = await table.getPage({ offset, limit })
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

  const exportImage = () => {
    const canvas = window.document.querySelector(
      ".chart-canvas-container canvas"
    ) as HTMLCanvasElement | null
    if (!canvas) return
    const url = canvas.toDataURL("image/png")
    const a = window.document.createElement("a")
    a.href = url
    a.download = `chart-${Date.now()}.png`
    a.click()
  }

  return (
    <main className="chart-root">
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
          {config.type !== "Number" && isConfigured && data.items.length > 0 && (
            <button
              className="chart-btn"
              onClick={exportImage}
              title="Export as PNG image"
            >
              Export PNG
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
  const table = ctx.table
  if (!table) {
    throw new Error("Chart plugin requires a table view")
  }
  const root = createRoot(element)
  root.render(<ChartView table={table} />)
  return {
    dispose: () => root.unmount(),
  }
}

export default mount
