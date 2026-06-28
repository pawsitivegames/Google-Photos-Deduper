import { describe, expect, it } from "vitest"

import { chooseKeepKeyForGroup } from "../../lib/keep-strategy"
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
    creationTimestamp: Date.parse("2024-01-01T00:00:00.000Z"),
    resWidth: 1000,
    resHeight: 1000,
    isOriginalQuality: null,
    ...overrides
  }
}

const group: DuplicateGroup = {
  id: "group-1",
  mediaKeys: ["a", "b", "c"],
  originalMediaKey: "a",
  similarity: 0.99
}

const pairGroup: DuplicateGroup = {
  id: "pair-1",
  mediaKeys: ["a", "b"],
  originalMediaKey: "a",
  similarity: 0.99
}

describe("keep strategy", () => {
  it("keeps the richer-metadata item for an exact two-item duplicate pair", () => {
    expect(
      chooseKeepKeyForGroup(
        pairGroup,
        {
          a: item("a", {
            dedupKey: "same-dedup-key",
            isOriginalQuality: true,
            resWidth: 4000,
            resHeight: 3000,
            fileName: undefined,
            size: undefined,
            takesUpSpace: null,
            spaceTaken: undefined,
            productUrl: undefined
          }),
          b: item("b", {
            dedupKey: "same-dedup-key",
            isOriginalQuality: false,
            resWidth: 1000,
            resHeight: 1000,
            fileName: "metadata-rich.jpg",
            size: 123456,
            takesUpSpace: true,
            spaceTaken: 123456,
            productUrl: "https://photos.google.com/photo/b"
          })
        },
        "best_quality"
      )
    ).toBe("b")
  })

  it("does not prefer metadata over quality for similar-only pairs", () => {
    expect(
      chooseKeepKeyForGroup(
        pairGroup,
        {
          a: item("a", {
            dedupKey: "dedup-a",
            isOriginalQuality: true,
            resWidth: 4000,
            resHeight: 3000
          }),
          b: item("b", {
            dedupKey: "dedup-b",
            isOriginalQuality: false,
            resWidth: 1000,
            resHeight: 1000,
            fileName: "metadata-rich.jpg",
            size: 123456,
            takesUpSpace: true,
            spaceTaken: 123456,
            productUrl: "https://photos.google.com/photo/b"
          })
        },
        "best_quality"
      )
    ).toBe("a")
  })

  it("keeps the original-quality item for best quality", () => {
    expect(
      chooseKeepKeyForGroup(
        group,
        {
          a: item("a", { isOriginalQuality: false, resWidth: 4000 }),
          b: item("b", { isOriginalQuality: true, resWidth: 1000 }),
          c: item("c", { isOriginalQuality: null, resWidth: 3000 })
        },
        "best_quality"
      )
    ).toBe("b")
  })

  it("keeps the oldest taken item for best quality when quality ties", () => {
    expect(
      chooseKeepKeyForGroup(
        group,
        {
          a: item("a", {
            timestamp: Date.parse("2024-01-01T00:00:00.000Z"),
            isOriginalQuality: true,
            resWidth: 4000,
            resHeight: 3000
          }),
          b: item("b", {
            timestamp: Date.parse("2021-01-01T00:00:00.000Z"),
            isOriginalQuality: true,
            resWidth: 1000,
            resHeight: 1000
          }),
          c: item("c", {
            timestamp: Date.parse("2023-01-01T00:00:00.000Z"),
            isOriginalQuality: true,
            resWidth: 3000,
            resHeight: 2000
          })
        },
        "best_quality"
      )
    ).toBe("b")
  })

  it("keeps an item with a taken date over a missing taken date for best quality", () => {
    expect(
      chooseKeepKeyForGroup(
        group,
        {
          a: item("a", {
            timestamp: undefined,
            isOriginalQuality: true,
            resWidth: 4000,
            resHeight: 3000
          }),
          b: item("b", {
            timestamp: Date.parse("2024-01-01T00:00:00.000Z"),
            isOriginalQuality: true,
            resWidth: 1000,
            resHeight: 1000
          }),
          c: item("c", {
            timestamp: undefined,
            isOriginalQuality: true,
            resWidth: 3000,
            resHeight: 2000
          })
        },
        "best_quality"
      )
    ).toBe("b")
  })

  it("falls back to resolution for best quality when taken dates are missing", () => {
    expect(
      chooseKeepKeyForGroup(
        group,
        {
          a: item("a", {
            timestamp: undefined,
            isOriginalQuality: true,
            resWidth: 1000,
            resHeight: 1000
          }),
          b: item("b", {
            timestamp: undefined,
            isOriginalQuality: true,
            resWidth: 4000,
            resHeight: 3000
          }),
          c: item("c", {
            timestamp: undefined,
            isOriginalQuality: true,
            resWidth: 3000,
            resHeight: 2000
          })
        },
        "best_quality"
      )
    ).toBe("b")
  })

  it("keeps a newer taken item for best quality when it is better quality", () => {
    expect(
      chooseKeepKeyForGroup(
        group,
        {
          a: item("a", {
            timestamp: Date.parse("2021-01-01T00:00:00.000Z"),
            isOriginalQuality: false,
            resWidth: 4000,
            resHeight: 3000
          }),
          b: item("b", {
            timestamp: Date.parse("2024-01-01T00:00:00.000Z"),
            isOriginalQuality: true,
            resWidth: 1000,
            resHeight: 1000
          }),
          c: item("c", {
            timestamp: Date.parse("2023-01-01T00:00:00.000Z"),
            isOriginalQuality: null,
            resWidth: 3000,
            resHeight: 2000
          })
        },
        "best_quality"
      )
    ).toBe("b")
  })

  it("keeps the item with the largest resolution", () => {
    expect(
      chooseKeepKeyForGroup(
        group,
        {
          a: item("a", { resWidth: 1000, resHeight: 1000 }),
          b: item("b", { resWidth: 3000, resHeight: 2000 }),
          c: item("c", { resWidth: 2000, resHeight: 2000 })
        },
        "largest_resolution"
      )
    ).toBe("b")
  })

  it("keeps newest and oldest taken dates", () => {
    const mediaItems = {
      a: item("a", { timestamp: Date.parse("2022-01-01T00:00:00.000Z") }),
      b: item("b", { timestamp: Date.parse("2024-01-01T00:00:00.000Z") }),
      c: item("c", { timestamp: Date.parse("2023-01-01T00:00:00.000Z") })
    }

    expect(chooseKeepKeyForGroup(group, mediaItems, "newest_taken")).toBe("b")
    expect(chooseKeepKeyForGroup(group, mediaItems, "oldest_taken")).toBe("a")
  })

  it("keeps the newest upload date", () => {
    expect(
      chooseKeepKeyForGroup(
        group,
        {
          a: item("a", {
            creationTimestamp: Date.parse("2022-01-01T00:00:00.000Z")
          }),
          b: item("b", {
            creationTimestamp: Date.parse("2024-01-01T00:00:00.000Z")
          }),
          c: item("c", {
            creationTimestamp: Date.parse("2023-01-01T00:00:00.000Z")
          })
        },
        "newest_upload"
      )
    ).toBe("b")
  })

  it("keeps the item confirmed not to count against storage", () => {
    expect(
      chooseKeepKeyForGroup(
        group,
        {
          a: item("a", { takesUpSpace: true, isOriginalQuality: true }),
          b: item("b", { takesUpSpace: false, isOriginalQuality: false }),
          c: item("c", { takesUpSpace: null, isOriginalQuality: true })
        },
        "non_storage_counting"
      )
    ).toBe("b")
  })
})
