import { useEffect, useRef } from "react"
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  BarController,
  LineElement,
  LineController,
  PointElement,
  ArcElement,
  DoughnutController,
  Title,
  Tooltip,
  Legend,
  Filler,
  type ChartData,
  type ChartOptions,
} from "chart.js"
import {
  formatMetricNumber,
  getChartColor,
  getChartPalette,
} from "../aggregate"
import type { ChartConfig, ChartDataItem } from "../types"

// Register only needed Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  BarController,
  LineElement,
  LineController,
  PointElement,
  ArcElement,
  DoughnutController,
  Title,
  Tooltip,
  Legend,
  Filler
)

export function ChartCanvas({
  items,
  config,
  isDark,
}: {
  items: ChartDataItem[]
  config: ChartConfig
  isDark: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartInstanceRef = useRef<ChartJS | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy()
      chartInstanceRef.current = null
    }

    const labels = items.map((item) => item.label)
    const values = items.map((item) => item.value)
    const colors = getChartPalette(items.length, isDark)

    const gridColor = isDark
      ? "rgba(255, 255, 255, 0.08)"
      : "rgba(0, 0, 0, 0.06)"
    const tickColor = isDark ? "#9b9a97" : "#787774"
    const surfaceBg = isDark ? "#252525" : "#ffffff"
    const textColor = isDark ? "#e3e2de" : "#37352f"
    const borderColor = isDark ? "#404040" : "#e5e5e5"

    let chartType: "bar" | "line" | "doughnut" = "bar"
    let data: ChartData = { labels, datasets: [] }
    let options: ChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 350 },
      plugins: {
        legend: {
          display: config.legend && config.type === "Donut",
          position: "bottom",
          labels: {
            color: textColor,
            font: { family: "system-ui, -apple-system, sans-serif", size: 12 },
            boxWidth: 10,
            boxHeight: 10,
            usePointStyle: true,
            padding: 16,
          },
        },
        tooltip: {
          backgroundColor: surfaceBg,
          titleColor: isDark ? "#ffffff" : "#1a1a1a",
          bodyColor: textColor,
          borderColor: borderColor,
          borderWidth: 1,
          cornerRadius: 6,
          padding: 10,
          boxPadding: 4,
          usePointStyle: true,
          callbacks: {
            label(context) {
              const parsed = context.parsed as any
              const val =
                typeof parsed === "number"
                  ? parsed
                  : (parsed?.y ?? parsed?.x ?? 0)
              return ` ${config.aggregate}: ${formatMetricNumber(val)}`
            },
          },
        },
      },
    }

    if (config.type === "Column") {
      chartType = "bar"
      data = {
        labels,
        datasets: [
          {
            label: config.aggregate,
            data: values,
            backgroundColor: colors,
            borderRadius: 4,
            borderSkipped: false,
            maxBarThickness: 48,
          },
        ],
      }
      options.scales = {
        x: {
          grid: { display: false },
          ticks: {
            color: tickColor,
            font: { size: 12 },
            maxRotation: 45,
            minRotation: 0,
            autoSkip: true,
            autoSkipPadding: 8,
          },
          border: { display: false },
        },
        y: {
          beginAtZero: true,
          grace: "5%",
          grid: { color: gridColor },
          ticks: {
            color: tickColor,
            font: { size: 12 },
            precision: config.aggregate === "Count" ? 0 : undefined,
            callback: (val) =>
              typeof val === "number" ? formatMetricNumber(val) : String(val),
          },
          border: { display: false },
        },
      }
    } else if (config.type === "Bar") {
      chartType = "bar"
      data = {
        labels,
        datasets: [
          {
            label: config.aggregate,
            data: values,
            backgroundColor: colors,
            borderRadius: 4,
            borderSkipped: false,
            maxBarThickness: 32,
          },
        ],
      }
      options.indexAxis = "y"
      options.scales = {
        x: {
          beginAtZero: true,
          grace: "5%",
          grid: { color: gridColor },
          ticks: {
            color: tickColor,
            font: { size: 12 },
            precision: config.aggregate === "Count" ? 0 : undefined,
            callback: (val) =>
              typeof val === "number" ? formatMetricNumber(val) : String(val),
          },
          border: { display: false },
        },
        y: {
          grid: { display: false },
          ticks: { color: tickColor, font: { size: 12 } },
          border: { display: false },
        },
      }
    } else if (config.type === "Line") {
      chartType = "line"
      const lineColor = getChartColor(0, isDark)
      data = {
        labels,
        datasets: [
          {
            label: config.aggregate,
            data: values,
            borderColor: lineColor,
            backgroundColor: isDark
              ? "rgba(82, 156, 202, 0.15)"
              : "rgba(35, 131, 226, 0.12)",
            borderWidth: 2.5,
            fill: true,
            tension: 0.35,
            pointBackgroundColor: lineColor,
            pointBorderColor: isDark ? "#191919" : "#ffffff",
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6,
          },
        ],
      }
      options.scales = {
        x: {
          grid: { display: false },
          ticks: {
            color: tickColor,
            font: { size: 12 },
            maxRotation: 45,
            minRotation: 0,
            autoSkip: true,
            autoSkipPadding: 8,
          },
          border: { display: false },
        },
        y: {
          beginAtZero: true,
          grace: "5%",
          grid: { color: gridColor },
          ticks: {
            color: tickColor,
            font: { size: 12 },
            precision: config.aggregate === "Count" ? 0 : undefined,
            callback: (val) =>
              typeof val === "number" ? formatMetricNumber(val) : String(val),
          },
          border: { display: false },
        },
      }
    } else if (config.type === "Donut") {
      chartType = "doughnut"
      data = {
        labels,
        datasets: [
          {
            label: config.aggregate,
            data: values,
            backgroundColor: colors,
            borderColor: isDark ? "#191919" : "#ffffff",
            borderWidth: 2,
            hoverOffset: 4,
          },
        ],
      }
      ;(options as any).cutout = "65%"
    }

    const chart = new ChartJS(canvas, {
      type: chartType,
      data,
      options,
    })

    chartInstanceRef.current = chart

    return () => {
      chart.destroy()
      chartInstanceRef.current = null
    }
  }, [items, config, isDark])

  return (
    <div
      className="chart-canvas-container"
      style={{
        minHeight:
          config.type === "Bar" ? Math.max(260, items.length * 28) : undefined,
      }}
    >
      <canvas ref={canvasRef} />
    </div>
  )
}
