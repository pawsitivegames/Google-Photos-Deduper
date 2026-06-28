import { describe, expect, it } from "vitest"

import { buildCacheDiagnosticsReport } from "../../lib/cache-diagnostics"
import type { EmbeddingRecord } from "../../lib/embedding-cache"

describe("cache diagnostics report", () => {
  it("exports metadata and embedding dimensions without raw vector values", () => {
    const records: EmbeddingRecord[] = [
      {
        mediaKey: "b",
        embedding: new Float32Array([0.1, 0.2, 0.3]),
        scannedAt: 0,
        model: "scripts/model.tflite",
        metadata: {
          dedupKey: "dk-b",
          thumb: "https://thumb/b",
          timestamp: 1000,
          creationTimestamp: 2000,
          fileName: "b.jpg"
        }
      },
      {
        mediaKey: "a",
        embedding: new Float32Array([0.4, 0.5])
      }
    ]

    const report = buildCacheDiagnosticsReport(records)

    expect(report.totalRecords).toBe(2)
    expect(report.recordsWithMetadata).toBe(1)
    expect(report.items.map((item) => item.mediaKey)).toEqual(["a", "b"])
    expect(report.items[1]).toMatchObject({
      mediaKey: "b",
      hasEmbedding: true,
      embeddingDimensions: 3,
      scannedAt: "1970-01-01T00:00:00.000Z",
      model: "scripts/model.tflite",
      metadata: {
        dedupKey: "dk-b",
        fileName: "b.jpg"
      }
    })
    for (const item of report.items) {
      expect(item).not.toHaveProperty("embedding")
      expect(item).not.toHaveProperty("vector")
    }
  })
})
