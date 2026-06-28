import type { DuplicateGroup, GpdMediaItem } from "./types"

export interface DuplicateClassification {
  duplicateKind: "exact" | "similar"
  matchReasons: string[]
}

function allSame<T>(values: T[]): boolean {
  return values.length > 1 && values.every((value) => value === values[0])
}

function presentValues<T>(
  items: GpdMediaItem[],
  read: (item: GpdMediaItem) => T | undefined
): T[] {
  return items
    .map(read)
    .filter((value): value is T => value !== undefined && value !== null)
}

export function classifyDuplicateItems(
  items: GpdMediaItem[]
): DuplicateClassification {
  const reasons: string[] = []

  const dedupKeys = presentValues(items, (item) => item.dedupKey)
  if (dedupKeys.length === items.length && allSame(dedupKeys)) {
    reasons.push("same dedupKey")
  }

  const fileNames = presentValues(items, (item) => item.fileName)
  if (fileNames.length === items.length && allSame(fileNames)) {
    reasons.push("same filename")
  }

  const dimensions = items
    .map((item) =>
      item.resWidth && item.resHeight
        ? `${item.resWidth}x${item.resHeight}`
        : undefined
    )
    .filter((value): value is string => !!value)
  if (dimensions.length === items.length && allSame(dimensions)) {
    reasons.push("same dimensions")
  }

  const takenDates = presentValues(items, (item) => item.timestamp)
  if (takenDates.length === items.length && allSame(takenDates)) {
    reasons.push("same taken date")
  }

  const sizes = presentValues(items, (item) => item.size)
  if (sizes.length === items.length && allSame(sizes)) {
    reasons.push("same file size")
  }

  const exactByDedupKey = reasons.includes("same dedupKey")
  const exactByMetadata =
    reasons.includes("same filename") &&
    reasons.includes("same dimensions") &&
    reasons.includes("same taken date") &&
    (sizes.length === 0 || reasons.includes("same file size"))

  return {
    duplicateKind: exactByDedupKey || exactByMetadata ? "exact" : "similar",
    matchReasons: reasons
  }
}

export function classifyDuplicateGroup(
  group: DuplicateGroup,
  mediaItems: Record<string, GpdMediaItem>
): DuplicateClassification {
  const items = group.mediaKeys
    .map((key) => mediaItems[key])
    .filter((item): item is GpdMediaItem => !!item)
  return classifyDuplicateItems(items)
}
