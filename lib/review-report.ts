import { classifyDuplicateGroup } from "./duplicate-classifier"
import type { DuplicateGroup, GpdMediaItem } from "./types"

export interface ReviewReportItem {
  duplicateGroupId: string
  groupSelected: boolean
  selectedForTrash: boolean
  kept: boolean
  mediaKey: string
  dedupKey: string
  fileName: string | null
  takenAt: string | null
  uploadedAt: string | null
  resolution: string | null
  isOriginalQuality: boolean | null
  takesUpSpace: boolean | null
  spaceTaken: number | null
  similarity: number
  duplicateKind: "exact" | "similar"
  matchReasons: string[]
  googlePhotosUrl: string | null
}

export interface ReviewReport {
  reportId: string
  createdAt: string
  totalGroups: number
  totalItems: number
  totalGroupsSelected: number
  totalItemsSelectedForTrash: number
  items: ReviewReportItem[]
}

export function formatReportTimestamp(
  value: number | undefined
): string | null {
  if (value === undefined || value === null) return null
  return new Date(value).toISOString()
}

export function formatReportResolution(item: GpdMediaItem): string | null {
  if (!item.resWidth || !item.resHeight) return null
  return `${item.resWidth}x${item.resHeight}`
}

export function buildReviewReport(params: {
  groups: DuplicateGroup[]
  mediaItems: Record<string, GpdMediaItem>
  selectedGroupIds: Set<string>
  getKept: (group: DuplicateGroup) => Set<string>
}): ReviewReport {
  const items: ReviewReportItem[] = []
  let totalGroupsSelected = 0

  for (const group of params.groups) {
    const groupSelected = params.selectedGroupIds.has(group.id)
    if (groupSelected) totalGroupsSelected++
    const groupKeySet = new Set(group.mediaKeys)
    const validKeptKeys = [...params.getKept(group)].filter((key) =>
      groupKeySet.has(key)
    )
    const keptSet = new Set(
      validKeptKeys.length > 0
        ? validKeptKeys
        : [group.originalMediaKey].filter((key) => groupKeySet.has(key))
    )
    const classification =
      group.duplicateKind && group.matchReasons
        ? {
            duplicateKind: group.duplicateKind,
            matchReasons: group.matchReasons
          }
        : classifyDuplicateGroup(group, params.mediaItems)
    for (const mediaKey of group.mediaKeys) {
      const item = params.mediaItems[mediaKey]
      if (!item) continue
      const kept = keptSet.has(mediaKey)
      items.push({
        duplicateGroupId: group.id,
        groupSelected,
        selectedForTrash: groupSelected && !kept,
        kept,
        mediaKey: item.mediaKey,
        dedupKey: item.dedupKey,
        fileName: item.fileName ?? null,
        takenAt: formatReportTimestamp(item.timestamp),
        uploadedAt: formatReportTimestamp(item.creationTimestamp),
        resolution: formatReportResolution(item),
        isOriginalQuality: item.isOriginalQuality ?? null,
        takesUpSpace: item.takesUpSpace ?? null,
        spaceTaken: item.spaceTaken ?? null,
        similarity: group.similarity,
        duplicateKind: classification.duplicateKind,
        matchReasons: classification.matchReasons,
        googlePhotosUrl: item.productUrl ?? null
      })
    }
  }

  return {
    reportId: `gpd-review-report-${new Date().toISOString().replace(/[:.]/g, "-")}`,
    createdAt: new Date().toISOString(),
    totalGroups: params.groups.length,
    totalItems: items.length,
    totalGroupsSelected,
    totalItemsSelectedForTrash: items.filter((item) => item.selectedForTrash)
      .length,
    items
  }
}

function csvValue(value: unknown): string {
  if (value === null || value === undefined) return ""
  const text = String(value)
  if (!/[",\n\r]/.test(text)) return text
  return `"${text.replace(/"/g, '""')}"`
}

export function reviewReportToCsv(report: ReviewReport): string {
  const headers: (keyof ReviewReportItem)[] = [
    "duplicateGroupId",
    "groupSelected",
    "selectedForTrash",
    "kept",
    "mediaKey",
    "dedupKey",
    "fileName",
    "takenAt",
    "uploadedAt",
    "resolution",
    "isOriginalQuality",
    "takesUpSpace",
    "spaceTaken",
    "similarity",
    "duplicateKind",
    "matchReasons",
    "googlePhotosUrl"
  ]
  const rows = report.items.map((item) =>
    headers.map((header) => csvValue(item[header])).join(",")
  )
  return [headers.join(","), ...rows].join("\n")
}
