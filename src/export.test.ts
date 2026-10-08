import { expect, it, vi } from "vitest"
import { exportChartPng } from "./export"

function canvas(blob: Blob | null): HTMLCanvasElement {
  return {
    toBlob: (callback: BlobCallback) => callback(blob),
  } as HTMLCanvasElement
}
it("exports PNG bytes through the host and distinguishes saved, dispatched and cancelled", async () => {
  for (const [status, message] of [
    ["saved", "PNG saved."],
    ["download-started", "PNG download started."],
    ["cancelled", "Export cancelled."],
  ] as const) {
    const exportFile = vi.fn(async () => ({ status }))
    expect(
      await exportChartPng(
        canvas(new Blob([new Uint8Array([0, 1, 255])])),
        exportFile,
        "chart.png"
      )
    ).toBe(message)
    expect(exportFile).toHaveBeenCalledWith({
      name: "chart.png",
      mimeType: "image/png",
      data: new Uint8Array([0, 1, 255]),
    })
  }
})
it("reports a missing canvas, failed encoding and failed save instead of silently returning", async () => {
  const save = vi.fn(async () => ({ status: "saved" as const }))
  await expect(exportChartPng(null, save, "chart.png")).rejects.toThrow(
    "not ready"
  )
  await expect(exportChartPng(canvas(null), save, "chart.png")).rejects.toThrow(
    "create the PNG"
  )
  expect(save).not.toHaveBeenCalled()
  save.mockRejectedValueOnce(new Error("Disk full"))
  await expect(
    exportChartPng(canvas(new Blob(["image"])), save, "chart.png")
  ).rejects.toThrow("Disk full")
})
