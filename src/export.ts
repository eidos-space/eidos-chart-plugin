import type { HostUI } from "@eidos.space/plugin-sdk"

export type ChartHostUI = HostUI

export async function exportChartPng(
  canvas: HTMLCanvasElement | null,
  exportFile: NonNullable<ChartHostUI["exportFile"]>,
  name: string
): Promise<string> {
  if (!canvas) throw new Error("The chart is not ready to export.")
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error("Could not create the PNG image."))
    }, "image/png")
  })
  const result = await exportFile({
    name,
    mimeType: "image/png",
    data: new Uint8Array(await blob.arrayBuffer()),
  })
  if (result.status === "cancelled") return "Export cancelled."
  return result.status === "saved" ? "PNG saved." : "PNG download started."
}
