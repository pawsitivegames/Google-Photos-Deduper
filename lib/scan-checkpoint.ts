import type { GpdMediaItem, ScanPhase, ScanSettings } from "./types"
import { areScanResultsValid } from "./scan-results"

export const SCAN_CHECKPOINT_KEY = "scanCheckpoint"
export const MAX_CHECKPOINT_MEDIA_ITEMS = 5000

export type ScanCheckpointStatus =
  | "active"
  | "interrupted"
  | "cancelled"
  | "error"

export interface ScanCheckpoint {
  id: string
  status: ScanCheckpointStatus
  startedAt: number
  updatedAt: number
  settings: ScanSettings
  accountEmail?: string
  phase: ScanPhase
  itemsProcessed: number
  totalEstimate: number
  message: string
  error?: string
  mediaItems?: GpdMediaItem[]
}

export function createScanCheckpoint(params: {
  id: string
  settings: ScanSettings
  accountEmail?: string
  now?: number
}): ScanCheckpoint {
  const now = params.now ?? Date.now()
  return {
    id: params.id,
    status: "active",
    startedAt: now,
    updatedAt: now,
    settings: params.settings,
    accountEmail: params.accountEmail,
    phase: "fetching",
    itemsProcessed: 0,
    totalEstimate: 0,
    message: "Starting scan..."
  }
}

export function updateScanCheckpoint(
  checkpoint: ScanCheckpoint,
  patch: Partial<
    Pick<
      ScanCheckpoint,
      | "status"
      | "phase"
      | "itemsProcessed"
      | "totalEstimate"
      | "message"
      | "error"
      | "mediaItems"
    >
  >,
  now = Date.now()
): ScanCheckpoint {
  return {
    ...checkpoint,
    ...patch,
    updatedAt: now
  }
}

export function shouldOfferResume(
  checkpoint: ScanCheckpoint | null | undefined
): checkpoint is ScanCheckpoint {
  if (checkpoint?.status !== "interrupted" && checkpoint?.status !== "error") {
    return false
  }
  return !checkpoint.settings.amazonBatchLimit && !checkpoint.settings.icloudBatchLimit
}

export function summarizeScanCheckpoint(checkpoint: ScanCheckpoint): string {
  const range = checkpoint.settings.dateRange
  const album = checkpoint.settings.albumScope
  const dateScope =
    range?.from || range?.to
      ? `${range.from ?? "beginning"} to ${range.to ?? "today"}`
      : null
  const albumScope = album ? `album ${album.title || album.mediaKey}` : null
  const scope =
    albumScope && dateScope
      ? `${albumScope}, ${dateScope}`
      : albumScope || dateScope || "full library"
  return `${checkpoint.settings.scanMode} scan, ${scope}`
}

export function describeScanCheckpointResume(
  checkpoint: ScanCheckpoint
): string {
  if (checkpoint.mediaItems && checkpoint.mediaItems.length > 0) {
    const count = checkpoint.mediaItems.length
    return `Fetched media list (${count.toLocaleString()} item${count !== 1 ? "s" : ""}) will be reused.`
  }
  return "Cached embeddings from completed work will be reused."
}

export function canResumeScanCheckpoint(
  checkpoint: ScanCheckpoint,
  context: { accountEmail?: string }
): boolean {
  return areScanResultsValid(
    { accountEmail: checkpoint.accountEmail },
    { accountEmail: context.accountEmail }
  )
}
