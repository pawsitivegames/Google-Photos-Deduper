import { describe, expect, it } from "vitest"

import {
  classifyDuplicateGroup,
  classifyDuplicateItems
} from "../../lib/duplicate-classifier"
import type { DuplicateGroup, GpdMediaItem } from "../../lib/types"

function item(
  mediaKey: string,
  overrides: Partial<GpdMediaItem> = {}
): GpdMediaItem {
  return {
    mediaKey,
    dedupKey: `dk-${mediaKey}`,
    thumb: `https://example.com/${mediaKey}`,
    timestamp: Date.parse("2024-01-01T00:00:00.000Z"),
    creationTimestamp: Date.parse("2024-01-02T00:00:00.000Z"),
    resWidth: 1920,
    resHeight: 1080,
    fileName: `${mediaKey}.jpg`,
    ...overrides
  }
}

describe("duplicate classifier", () => {
  it("classifies identical dedupKey groups as exact", () => {
    const result = classifyDuplicateItems([
      item("a", { dedupKey: "same" }),
      item("b", { dedupKey: "same" })
    ])

    expect(result.duplicateKind).toBe("exact")
    expect(result.matchReasons).toContain("same dedupKey")
  })

  it("classifies identical provider content hashes as exact", () => {
    const result = classifyDuplicateItems([
      item("a", { dedupKey: "node-a", exactContentHash: "amazon-md5-same" }),
      item("b", { dedupKey: "node-b", exactContentHash: "amazon-md5-same" })
    ])

    expect(result.duplicateKind).toBe("exact")
    expect(result.matchReasons).toContain("same content hash")
  })

  it("classifies same filename, dimensions, and taken date as exact", () => {
    const result = classifyDuplicateItems([
      item("a", { fileName: "IMG.jpg" }),
      item("b", { fileName: "IMG.jpg" })
    ])

    expect(result.duplicateKind).toBe("exact")
    expect(result.matchReasons).toEqual(
      expect.arrayContaining([
        "same filename",
        "same dimensions",
        "same taken date"
      ])
    )
  })

  it("classifies visual-only matches as similar", () => {
    const result = classifyDuplicateItems([
      item("a", { fileName: "a.jpg" }),
      item("b", { fileName: "b.jpg", timestamp: Date.parse("2024-01-03") })
    ])

    expect(result.duplicateKind).toBe("similar")
  })

  it("classifies strong video metadata matches as exact without requiring same taken date", () => {
    const result = classifyDuplicateItems([
      item("a", {
        fileName: "clip.mov",
        timestamp: Date.parse("2021-01-01"),
        duration: 12_345
      }),
      item("b", {
        fileName: "clip.mov",
        timestamp: Date.parse("2024-01-01"),
        duration: 12_345
      })
    ])

    expect(result.duplicateKind).toBe("exact")
    expect(result.matchReasons).toEqual(
      expect.arrayContaining([
        "same filename",
        "same dimensions",
        "same duration"
      ])
    )
  })

  it("classifies video filename stem and duration matches as exact when extensions differ", () => {
    const result = classifyDuplicateItems([
      item("a", {
        fileName: "clip.mov",
        resWidth: 1920,
        resHeight: 1080,
        duration: 12_345
      }),
      item("b", {
        fileName: "clip.mp4",
        resWidth: 1280,
        resHeight: 720,
        duration: 12_345
      })
    ])

    expect(result.duplicateKind).toBe("exact")
    expect(result.matchReasons).toEqual(
      expect.arrayContaining(["same filename stem", "same duration"])
    )
  })

  it("classifies video size and duration matches as exact when dimensions are missing", () => {
    const result = classifyDuplicateItems([
      item("a", {
        fileName: undefined,
        resWidth: undefined,
        resHeight: undefined,
        size: 3_500_000,
        duration: 12_345
      }),
      item("b", {
        fileName: undefined,
        resWidth: undefined,
        resHeight: undefined,
        size: 3_500_000,
        duration: 12_345
      })
    ])

    expect(result.duplicateKind).toBe("exact")
    expect(result.matchReasons).toEqual(
      expect.arrayContaining(["same file size", "same duration"])
    )
  })

  it("classifies groups from media keys", () => {
    const group: DuplicateGroup = {
      id: "g1",
      mediaKeys: ["a", "b"],
      originalMediaKey: "a",
      similarity: 0.99
    }

    expect(
      classifyDuplicateGroup(group, {
        a: item("a", { dedupKey: "same" }),
        b: item("b", { dedupKey: "same" })
      }).duplicateKind
    ).toBe("exact")
  })
})
