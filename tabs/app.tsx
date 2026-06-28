import "@fontsource/dm-sans/400.css"
import "@fontsource/dm-sans/500.css"
import "@fontsource/dm-sans/700.css"

import CloseIcon from "@mui/icons-material/Close"
import CollectionsRoundedIcon from "@mui/icons-material/CollectionsRounded"
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded"
import DoneAllRoundedIcon from "@mui/icons-material/DoneAllRounded"
import PhotoLibraryRoundedIcon from "@mui/icons-material/PhotoLibraryRounded"
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded"
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded"
import Alert from "@mui/material/Alert"
import AppBar from "@mui/material/AppBar"
import Box from "@mui/material/Box"
import Button from "@mui/material/Button"
import CircularProgress from "@mui/material/CircularProgress"
import CssBaseline from "@mui/material/CssBaseline"
import Dialog from "@mui/material/Dialog"
import DialogActions from "@mui/material/DialogActions"
import DialogContent from "@mui/material/DialogContent"
import DialogContentText from "@mui/material/DialogContentText"
import DialogTitle from "@mui/material/DialogTitle"
import IconButton from "@mui/material/IconButton"
import LinearProgress from "@mui/material/LinearProgress"
import Snackbar from "@mui/material/Snackbar"
import { ThemeProvider } from "@mui/material/styles"
import TextField from "@mui/material/TextField"
import Toolbar from "@mui/material/Toolbar"
import Typography from "@mui/material/Typography"
import confetti from "canvas-confetti"
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction
} from "react"

import { ActionBar } from "../components/ActionBar"
import type { ReviewFilter } from "../components/ActionBar"
import { DuplicateGroups } from "../components/DuplicateGroups"
import { ScanConfig } from "../components/ScanConfig"
import { ScanProgress } from "../components/ScanProgress"
import { appReducer } from "../lib/app-reducer"
import type { AppAction, AppState } from "../lib/app-reducer"
import { buildCacheDiagnosticsReport } from "../lib/cache-diagnostics"
import { debug } from "../lib/debug"
import { buildDeleteReport, type DeleteReport } from "../lib/delete-report"
import { classifyDuplicateGroup } from "../lib/duplicate-classifier"
import {
  fullDetectDuplicates,
  selectDefaultKeep,
  smartDetectDuplicates
} from "../lib/duplicate-detector"
import type { DetectionProgress } from "../lib/duplicate-detector"
import { EmbeddingCache } from "../lib/embedding-cache"
import { chooseKeepKeyForGroup, type KeepStrategy } from "../lib/keep-strategy"
import { buildReviewReport, reviewReportToCsv } from "../lib/review-report"
import {
  canResumeScanCheckpoint,
  createScanCheckpoint,
  MAX_CHECKPOINT_MEDIA_ITEMS,
  SCAN_CHECKPOINT_KEY,
  shouldOfferResume,
  summarizeScanCheckpoint,
  updateScanCheckpoint,
  type ScanCheckpoint
} from "../lib/scan-checkpoint"
import { ScanLogger } from "../lib/scan-log"
import { areScanResultsValid } from "../lib/scan-results"
import theme from "../lib/theme"
import {
  buildTrashResultReport,
  type TrashResultReport
} from "../lib/trash-result-report"
import { APP_ID, DEFAULT_SETTINGS } from "../lib/types"
import type {
  AppMessage,
  DuplicateGroup,
  GpdAlbum,
  GpdMediaItem,
  GptkProgressMessage,
  GptkResultMessage,
  HealthCheckResultMessage,
  ScanSettings,
  StoredState
} from "../lib/types"

// ============================================================
// Helpers
// ============================================================

// Initial healthCheck retries. The first probe often fails on a freshly
// opened app tab because the bridge content script on photos.google.com has
// not finished loading yet, or because the MV3 service worker is still
// spinning up from idle. Backoff: 400ms, 800ms, 1600ms, 3200ms (5 attempts).
const HEALTH_CHECK_MAX_ATTEMPTS = 5
const TRASH_BATCH_SIZE = 25
const TRASH_BATCH_PAUSE_MS = 1000
const TRASH_RETRY_COUNT = 2
const TRASH_RETRY_BACKOFF_MS = 1000
const DELETE_REPORTS_KEY = "deleteReports"
const TRASH_RESULT_REPORTS_KEY = "trashResultReports"

function WorkflowRail({
  stage,
  totalItems,
  totalGroupCount,
  exactGroupCount,
  similarGroupCount,
  duplicateCount,
  scanDetail,
  onRescan
}: {
  stage: "setup" | "scan" | "review" | "trash" | "done"
  totalItems: number
  totalGroupCount: number
  exactGroupCount: number
  similarGroupCount: number
  duplicateCount: number
  scanDetail?: string
  onRescan: () => void
}) {
  const stageIndex = {
    setup: 0,
    scan: 1,
    review: 2,
    trash: 3,
    done: 3
  }[stage]
  const headline =
    stage === "setup"
      ? "Choose what to check"
      : stage === "scan"
        ? "Finding duplicates"
        : stage === "trash"
          ? "Moving to trash"
          : stage === "done"
            ? "Nothing to clean up"
            : "Choose what stays"
  const helper =
    stage === "setup"
      ? "Pick the library area and match sensitivity, then start the scan."
      : stage === "scan"
        ? "The extension is checking photos and videos and building review sets."
        : stage === "trash"
          ? "Included duplicates are moved in batches. Undo remains available after completion."
          : stage === "done"
            ? "No duplicate sets are waiting. Try different settings if needed."
            : "Pick the copy to keep in each set, then trash the rest safely."
  const steps = [
    {
      icon: <PhotoLibraryRoundedIcon fontSize="small" />,
      label: "Choose",
      value: stageIndex === 0 ? "Current" : "Done"
    },
    {
      icon: <RefreshRoundedIcon fontSize="small" />,
      label: "Find",
      value:
        stage === "scan"
          ? scanDetail || "Working"
          : stageIndex > 1
            ? "Done"
            : "Next"
    },
    {
      icon: <CollectionsRoundedIcon fontSize="small" />,
      label: "Review",
      value:
        stage === "review"
          ? `${totalGroupCount.toLocaleString()} sets`
          : stageIndex > 2
            ? "Done"
            : "Next"
    },
    {
      icon: <DeleteOutlineRoundedIcon fontSize="small" />,
      label: "Trash safely",
      value:
        stage === "trash"
          ? `${duplicateCount.toLocaleString()} moving`
          : stage === "review"
            ? `${duplicateCount.toLocaleString()} selected`
            : stage === "done"
              ? "Done"
              : "Final"
    }
  ]

  return (
    <Box
      component="aside"
      sx={{
        position: { md: "sticky" },
        top: { md: 88 },
        alignSelf: "flex-start",
        width: { xs: "100%", md: 272 },
        flexShrink: 0,
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 3,
        bgcolor: "rgba(255,255,255,0.72)",
        backdropFilter: "saturate(180%) blur(22px)",
        overflow: "hidden",
        boxShadow: "0 20px 56px rgba(0, 0, 0, 0.08)"
      }}>
      <Box sx={{ p: 2.25, borderBottom: "1px solid", borderColor: "divider" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
          {stage === "scan" ? (
            <CircularProgress size={16} thickness={5} />
          ) : (
            <DoneAllRoundedIcon color="success" fontSize="small" />
          )}
          <Typography variant="subtitle2" fontWeight={700}>
            {headline}
          </Typography>
        </Box>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: "block", mb: 2 }}>
          {helper}
        </Typography>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 1.5
          }}>
          <Box>
            <Typography variant="h6">
              {totalGroupCount.toLocaleString()}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              sets
            </Typography>
          </Box>
          <Box>
            <Typography variant="h6">{totalItems.toLocaleString()}</Typography>
            <Typography variant="caption" color="text.secondary">
              checked
            </Typography>
          </Box>
          <Box>
            <Typography variant="h6">
              {exactGroupCount.toLocaleString()}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              identical
            </Typography>
          </Box>
          <Box>
            <Typography variant="h6">
              {similarGroupCount.toLocaleString()}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              similar
            </Typography>
          </Box>
        </Box>
        <Button
          fullWidth
          variant="contained"
          startIcon={<PlayArrowRoundedIcon />}
          onClick={onRescan}
          sx={{ mt: 2, borderRadius: 999 }}>
          Start over
        </Button>
      </Box>

      <Box sx={{ p: 1 }}>
        {steps.map((item, index) => (
          <Box
            key={item.label}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.25,
              px: 1.25,
              py: 1.1,
              borderRadius: 2,
              color: index === stageIndex ? "primary.main" : "text.secondary",
              bgcolor: index === stageIndex ? "primary.light" : "transparent"
            }}>
            {item.icon}
            <Typography variant="body2" fontWeight={700} sx={{ flex: 1 }}>
              {item.label}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {item.value}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  )
}

function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function sendToServiceWorker(message: AppMessage): void {
  chrome.runtime.sendMessage(message)
}

function activeDateRange(
  dateRange: ScanSettings["dateRange"]
): ScanSettings["dateRange"] | undefined {
  if (!dateRange?.from && !dateRange?.to) return undefined
  return dateRange
}

function activeAlbumScope(
  albumScope: ScanSettings["albumScope"]
): ScanSettings["albumScope"] | undefined {
  return albumScope?.mediaKey ? albumScope : undefined
}

function fullScanSettingsPatch(
  scanSettings: ScanSettings
): Partial<ScanSettings> {
  return {
    sourceProvider: scanSettings.sourceProvider ?? "google",
    similarityThreshold: scanSettings.similarityThreshold,
    scanMode: scanSettings.scanMode,
    smartWindowSec: scanSettings.smartWindowSec,
    dateRange: scanSettings.dateRange,
    albumScope: scanSettings.albumScope
  }
}

function providerLabel(provider: ScanSettings["sourceProvider"]): string {
  return provider === "icloud" ? "iCloud Photos" : "Google Photos"
}

function providerUrl(provider: ScanSettings["sourceProvider"]): string {
  return provider === "icloud"
    ? "https://www.icloud.com/photos"
    : "https://photos.google.com/login"
}

function dateToUtcMs(value: string, endOfDay = false): number {
  return Date.parse(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`)
}

function filterMediaItemsByDateRange(
  items: GpdMediaItem[],
  dateRange: ScanSettings["dateRange"]
): GpdMediaItem[] {
  const range = activeDateRange(dateRange)
  if (!range) return items

  const fromMs = range.from ? dateToUtcMs(range.from) : Number.NEGATIVE_INFINITY
  const toMs = range.to ? dateToUtcMs(range.to, true) : Number.POSITIVE_INFINITY

  return items.filter((item) => {
    if (!Number.isFinite(item.timestamp)) return false
    return item.timestamp >= fromMs && item.timestamp <= toMs
  })
}

async function persistDeleteReport(report: DeleteReport): Promise<void> {
  try {
    const stored = await chrome.storage.local.get(DELETE_REPORTS_KEY)
    const reports =
      (stored[DELETE_REPORTS_KEY] as DeleteReport[] | undefined) ?? []
    reports.push(report)
    if (reports.length > 20) reports.splice(0, reports.length - 20)
    await chrome.storage.local.set({ [DELETE_REPORTS_KEY]: reports })
  } catch (error) {
    console.warn("[GPD] failed to persist delete report", error)
    throw error
  }
}

function downloadDeleteReport(report: DeleteReport): void {
  downloadTextFile({
    filename: `${report.reportId}.json`,
    contents: JSON.stringify(report, null, 2),
    type: "application/json"
  })
}

async function persistTrashResultReport(
  report: TrashResultReport
): Promise<void> {
  try {
    const stored = await chrome.storage.local.get(TRASH_RESULT_REPORTS_KEY)
    const reports =
      (stored[TRASH_RESULT_REPORTS_KEY] as TrashResultReport[] | undefined) ??
      []
    reports.push(report)
    if (reports.length > 20) reports.splice(0, reports.length - 20)
    await chrome.storage.local.set({ [TRASH_RESULT_REPORTS_KEY]: reports })
  } catch (error) {
    console.warn("[GPD] failed to persist trash result report", error)
    throw error
  }
}

function downloadTrashResultReport(report: TrashResultReport): void {
  downloadTextFile({
    filename: `${report.reportId}.json`,
    contents: JSON.stringify(report, null, 2),
    type: "application/json"
  })
}

function downloadTextFile(params: {
  filename: string
  contents: string
  type: string
}): void {
  const blob = new Blob([params.contents], { type: params.type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = params.filename
  a.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

function normalizeStoredSettings(settings: ScanSettings): ScanSettings {
  const isOldUntouchedDefault =
    settings.scanMode === "smart" &&
    settings.similarityThreshold === 0.99 &&
    (settings.smartWindowSec ?? 1) === 1 &&
    !activeDateRange(settings.dateRange) &&
    !activeAlbumScope(settings.albumScope)

  if (isOldUntouchedDefault) {
    return DEFAULT_SETTINGS
  }

  return {
    ...settings,
    sourceProvider: settings.sourceProvider ?? "google"
  }
}

async function persistScanCheckpoint(
  checkpoint: ScanCheckpoint
): Promise<void> {
  await chrome.storage.local
    .set({ [SCAN_CHECKPOINT_KEY]: checkpoint })
    .catch(() => {})
}

async function clearScanCheckpoint(): Promise<void> {
  await chrome.storage.local.remove(SCAN_CHECKPOINT_KEY).catch(() => {})
}

function clearResumeCheckpointState(params: {
  checkpointRef: MutableRefObject<ScanCheckpoint | null>
  setResumeCheckpoint: Dispatch<SetStateAction<ScanCheckpoint | null>>
}): void {
  params.checkpointRef.current = null
  params.setResumeCheckpoint(null)
  void clearScanCheckpoint()
}

type PendingSelections = {
  selectedGroupIds: Set<string>
  keptOverrides: Record<string, Set<string>>
}

function deserializeStoredSelections(value: unknown): PendingSelections | null {
  if (!value || typeof value !== "object") return null
  const raw = value as {
    selectedGroupIds?: unknown
    keptOverrides?: unknown
  }
  const selectedGroupIds = Array.isArray(raw.selectedGroupIds)
    ? raw.selectedGroupIds.filter((id): id is string => typeof id === "string")
    : []
  const keptOverrides: Record<string, Set<string>> = {}
  if (raw.keptOverrides && typeof raw.keptOverrides === "object") {
    for (const [groupId, mediaKeys] of Object.entries(
      raw.keptOverrides as Record<string, unknown>
    )) {
      if (!Array.isArray(mediaKeys)) continue
      const validMediaKeys = mediaKeys.filter(
        (key): key is string => typeof key === "string"
      )
      keptOverrides[groupId] = new Set(validMediaKeys)
    }
  }
  return {
    selectedGroupIds: new Set(selectedGroupIds),
    keptOverrides
  }
}

type UndoData = {
  dedupKeys: string[]
  count: number
  snapshot: {
    mediaItems: Record<string, GpdMediaItem>
    groups: DuplicateGroup[]
    totalItems: number
  }
}

// ============================================================
// App component
// ============================================================

export default function App() {
  const [state, dispatch] = useReducer(appReducer, { status: "connecting" })
  const [storageChecked, setStorageChecked] = useState(false)
  const [settings, setSettings] = useReducer(
    (prev: ScanSettings, next: Partial<ScanSettings>) => ({ ...prev, ...next }),
    DEFAULT_SETTINGS
  )

  // Selection state: which groups are selected for trash
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(
    new Set()
  )

  // Kept overrides: groupId -> Set of mediaKeys the user marked as "Keep"
  const [keptOverrides, setKeptOverrides] = useState<
    Record<string, Set<string>>
  >({})

  // Confirm dialog state
  const [trashConfirm, setTrashConfirm] = useState<{
    dedupKeys: string[]
    mediaKeysToTrash: string[]
  } | null>(null)
  const [trashConfirmCount, setTrashConfirmCount] = useState("")
  const [trashWarning, setTrashWarning] = useState<string | null>(null)
  const [reportError, setReportError] = useState<string | null>(null)
  const [cacheEntryCount, setCacheEntryCount] = useState<number | null>(null)
  const [cacheStatus, setCacheStatus] = useState<string | undefined>()
  const [cacheBusy, setCacheBusy] = useState(false)
  const [resumeCheckpoint, setResumeCheckpoint] =
    useState<ScanCheckpoint | null>(null)
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>("all")
  const [albums, setAlbums] = useState<GpdAlbum[]>([])
  const [albumsLoading, setAlbumsLoading] = useState(false)
  const [albumsError, setAlbumsError] = useState<string | null>(null)
  const [accountValidationComplete, setAccountValidationComplete] =
    useState(false)

  // Undo trash state: stored after a successful trash operation
  const [undoData, setUndoData] = useState<UndoData | null>(null)

  // Refs to capture pre-trash data for undo
  const preTrashSnapshotRef = useRef<{
    mediaItems: Record<string, GpdMediaItem>
    groups: DuplicateGroup[]
    totalItems: number
  } | null>(null)
  const pendingDedupKeysRef = useRef<string[] | null>(null)
  const pendingMediaKeysToTrashRef = useRef<string[] | null>(null)
  const pendingRestoreUndoRef = useRef<UndoData | null>(null)
  const pendingRestoreRequestIdRef = useRef<string | null>(null)

  // AbortController for the current scan (cancelled on user request or new scan)
  const scanAbortRef = useRef<AbortController | null>(null)

  // Persisted scan performance logger — survives page reloads via chrome.storage.local
  const scanLoggerRef = useRef(new ScanLogger())

  // Cached media items from previous scan, used to merge with incremental fetch
  const cachedMediaItemsRef = useRef<Record<string, GpdMediaItem> | null>(null)

  // Tracks the requestId of the active scan so stale results from previous
  // scans killed by reload can be dropped (they arrive late from the GP tab)
  const currentScanRequestIdRef = useRef<string | null>(null)
  const scanCheckpointRef = useRef<ScanCheckpoint | null>(null)

  // Counts failed healthCheck attempts during initial connect so we can retry
  // silently before showing a disconnected error.
  const healthCheckAttemptsRef = useRef(0)
  const albumsRequestedForAccountRef = useRef<string | null>(null)
  const currentAccountEmailRef = useRef<string | undefined>(undefined)
  const currentHasGptkRef = useRef(false)

  // Holds selections loaded from storage; applied once when groups first load
  const pendingSelectionsRef = useRef<PendingSelections | null>(null)

  const refreshEmbeddingCacheCount = useCallback(async () => {
    let cache: EmbeddingCache | null = null
    try {
      cache = await EmbeddingCache.open()
      setCacheEntryCount(await cache.count())
    } catch {
      setCacheEntryCount(null)
    } finally {
      cache?.close()
    }
  }, [])

  const requestAlbums = useCallback((accountEmail?: string) => {
    if ((settingsRef.current.sourceProvider ?? "google") !== "google") {
      setAlbums([])
      setAlbumsLoading(false)
      setAlbumsError(null)
      albumsRequestedForAccountRef.current = null
      return
    }
    const key = accountEmail || "__unknown__"
    albumsRequestedForAccountRef.current = key
    setAlbumsLoading(true)
    setAlbumsError(null)
    sendToServiceWorker({
      app: APP_ID,
      action: "gptkCommand",
      command: "listAlbums",
      requestId: generateRequestId(),
      provider: "google"
    })
  }, [])

  const saveTrashResultReport = useCallback((report: TrashResultReport) => {
    try {
      downloadTrashResultReport(report)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setReportError(`Could not download the trash result report: ${message}`)
    }

    void persistTrashResultReport(report).catch((error) => {
      const message = error instanceof Error ? error.message : String(error)
      setReportError(`Could not save the trash result report: ${message}`)
    })
  }, [])

  const patchScanCheckpoint = useCallback(
    (patch: Parameters<typeof updateScanCheckpoint>[1]) => {
      if (!scanCheckpointRef.current) return
      const next = updateScanCheckpoint(scanCheckpointRef.current, patch)
      scanCheckpointRef.current = next
      void persistScanCheckpoint(next)
    },
    []
  )

  // Sync selectedGroupIds when groups change (e.g. after scan or trash)
  const stateGroups =
    state.status === "results" || state.status === "trashing"
      ? state.groups
      : state.status === "scanning"
        ? state.partialGroups ?? null
        : null
  const groups = useMemo(() => stateGroups ?? [], [stateGroups])
  const displayMediaItems =
    state.status === "results" || state.status === "trashing"
      ? state.mediaItems
      : state.status === "scanning"
        ? state.partialMediaItems ?? {}
        : {}
  useEffect(() => {
    if (pendingSelectionsRef.current) {
      const saved = pendingSelectionsRef.current
      pendingSelectionsRef.current = null
      const validGroups = new Map(groups.map((group) => [group.id, group]))
      // Restore saved selection, filtered to groups that still exist
      const next = new Set(
        [...saved.selectedGroupIds].filter((id) => validGroups.has(id))
      )
      setSelectedGroupIds(next)
      // Restore kept overrides, filtered to keys that still exist in the group.
      // If every saved key is stale, fall back to the current default keep choice.
      const filteredKept: Record<string, Set<string>> = {}
      for (const [id, keys] of Object.entries(saved.keptOverrides)) {
        const group = validGroups.get(id)
        if (!group) continue
        const validKeys = new Set(group.mediaKeys)
        const filteredKeys = [...keys].filter((key) => validKeys.has(key))
        if (keys.size === 0 || filteredKeys.length > 0) {
          filteredKept[id] = new Set(filteredKeys)
        }
      }
      setKeptOverrides(filteredKept)
      const canWriteSanitizedSelections =
        state.status === "results" && !state.accountEmail
      if (canWriteSanitizedSelections) {
        chrome.storage.local.set({
          selections: {
            selectedGroupIds: [...next],
            keptOverrides: Object.fromEntries(
              Object.entries(filteredKept).map(([id, keys]) => [id, [...keys]])
            )
          }
        })
      }
    } else {
      setSelectedGroupIds(new Set(groups.map((g) => g.id)))
      setKeptOverrides({})
    }
  }, [groups])

  useEffect(() => {
    if (!accountValidationComplete || state.status !== "results") return
    const currentAccountEmail = currentAccountEmailRef.current
    if (
      !currentAccountEmail ||
      areScanResultsValid(
        {
          accountEmail: state.accountEmail,
          sourceProvider: settingsRef.current.sourceProvider
        },
        {
          accountEmail: currentAccountEmail,
          sourceProvider: settingsRef.current.sourceProvider
        }
      )
    ) {
      return
    }
    pendingSelectionsRef.current = null
    setSelectedGroupIds(new Set())
    setKeptOverrides({})
    chrome.storage.local.remove(["scanResults", "selections"])
    dispatch({
      type: "HEALTH_CHECK_RESULT",
      payload: {
        app: APP_ID,
        action: "healthCheck.result",
        success: true,
        hasGptk: currentHasGptkRef.current,
        accountEmail: currentAccountEmail
      }
    })
  }, [accountValidationComplete, state])

  const handleToggleGroup = useCallback((groupId: string) => {
    setSelectedGroupIds((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }, [])

  // Listen for messages from service worker
  useEffect(() => {
    const listener = (
      message: AppMessage,
      sender: chrome.runtime.MessageSender
    ) => {
      if (message?.app !== APP_ID) return
      // The bridge content script sends GPTK results via chrome.runtime.sendMessage,
      // which broadcasts to ALL extension contexts — so this listener fires twice:
      // once directly from the bridge (sender.tab set) and once via the service
      // worker relay (no sender.tab). Ignore direct bridge deliveries to avoid
      // processing each result twice.
      if (sender.tab) return

      switch (message.action) {
        case "healthCheck.result": {
          const msg = message as HealthCheckResultMessage
          // Swallow early "failed" results and retry — when the app tab opens
          // before the bridge content script has fully loaded on a fresh
          // photos.google.com tab, or when the service worker has just woken
          // up from MV3 idle, the first probe often misses. Without this the
          // user sees a spurious "disconnected" flash and has to manually hit
          // Retry. We give up after a few attempts and let the reducer show
          // the error.
          if (
            !msg.success &&
            healthCheckAttemptsRef.current < HEALTH_CHECK_MAX_ATTEMPTS - 1
          ) {
            healthCheckAttemptsRef.current++
            const delay = 400 * Math.pow(2, healthCheckAttemptsRef.current - 1)
            window.setTimeout(() => {
              sendToServiceWorker({
                app: APP_ID,
                action: "healthCheck",
                provider: settingsRef.current.sourceProvider ?? "google"
              })
            }, delay)
            return
          }
          if (msg.success) {
            healthCheckAttemptsRef.current = 0
            currentAccountEmailRef.current = msg.accountEmail
            currentHasGptkRef.current = msg.hasGptk
          }
          const currentState = stateRef.current
          const checkpoint = scanCheckpointRef.current
          if (
            msg.success &&
            checkpoint &&
            !areScanResultsValid(
              {
                accountEmail: checkpoint.accountEmail,
                sourceProvider: settingsRef.current.sourceProvider
              },
              {
                accountEmail: msg.accountEmail,
                sourceProvider: settingsRef.current.sourceProvider
              }
            )
          ) {
            clearResumeCheckpointState({
              checkpointRef: scanCheckpointRef,
              setResumeCheckpoint
            })
          }
          if (
            msg.success &&
            currentState.status === "results" &&
            !areScanResultsValid(
              {
                accountEmail: currentState.accountEmail,
                sourceProvider: settingsRef.current.sourceProvider
              },
              {
                accountEmail: msg.accountEmail,
                sourceProvider: settingsRef.current.sourceProvider
              }
            )
          ) {
            pendingSelectionsRef.current = null
            setSelectedGroupIds(new Set())
            setKeptOverrides({})
            chrome.storage.local.remove(["scanResults", "selections"])
          }
          setAccountValidationComplete(true)
          dispatch({
            type: "HEALTH_CHECK_RESULT",
            payload: msg
          })
          if (
            msg.success &&
            msg.hasGptk &&
            (settingsRef.current.sourceProvider ?? "google") === "google"
          ) {
            const key = msg.accountEmail || "__unknown__"
            if (albumsRequestedForAccountRef.current !== key) {
              requestAlbums(msg.accountEmail)
            }
          }
          break
        }
        case "gptkResult": {
          const result = message as GptkResultMessage
          if (result.command === "listAlbums") {
            setAlbumsLoading(false)
            if (result.success) {
              const nextAlbums = (result.data as GpdAlbum[]).filter(
                (album) => album.mediaKey
              )
              setAlbums(nextAlbums)
              setAlbumsError(null)
              const activeAlbum = activeAlbumScope(
                settingsRef.current.albumScope
              )
              if (
                activeAlbum &&
                !nextAlbums.some(
                  (album) => album.mediaKey === activeAlbum.mediaKey
                )
              ) {
                setSettings({ albumScope: undefined })
              }
            } else {
              setAlbumsError(result.error || "Could not load albums.")
            }
          } else if (result.command === "getAllMediaItems") {
            // Drop stale results from scans that were killed/cancelled — their
            // GPTK request may have still been in-flight and arrives late
            if (result.requestId !== currentScanRequestIdRef.current) {
              console.debug(
                `[GPD] Dropping stale getAllMediaItems result for requestId ${result.requestId} (active: ${currentScanRequestIdRef.current})`
              )
              break
            }
            if (result.success) {
              let items = result.data as GpdMediaItem[]
              const cached = cachedMediaItemsRef.current
              if (cached && Object.keys(cached).length > 0) {
                // Merge: new items take precedence over cached (handles field updates)
                const newItemKeys = new Set(items.map((i) => i.mediaKey))
                const cachedOnly = Object.values(cached).filter(
                  (i) => !newItemKeys.has(i.mediaKey)
                )
                items = [...items, ...cachedOnly]
                console.log(
                  `[GPD] media items: ${(result.data as GpdMediaItem[]).length} new + ${cachedOnly.length} cached = ${items.length} total`
                )
                cachedMediaItemsRef.current = null
              }
              items = filterMediaItemsByDateRange(
                items,
                settingsRef.current.dateRange
              )
              if (
                items.length === 0 &&
                (settingsRef.current.sourceProvider ?? "google") === "icloud"
              ) {
                const error =
                  "No loaded iCloud photos were found. Open iCloud Photos, wait for thumbnails to appear, scroll the library to load photos, then scan again."
                patchScanCheckpoint({
                  status: "error",
                  error,
                  message: error
                })
                setResumeCheckpoint(scanCheckpointRef.current)
                dispatch({
                  type: "SCAN_ERROR",
                  error
                })
                break
              }
              dispatch({
                type: "SCAN_MEDIA_FETCHED",
                mediaItems: items
              })
              patchScanCheckpoint({
                phase: "downloading_thumbnails",
                itemsProcessed: 0,
                totalEstimate: items.length,
                message: `Found ${items.length} photos and videos. Loading previews...`,
                mediaItems:
                  items.length <= MAX_CHECKPOINT_MEDIA_ITEMS ? items : undefined
              })
              runDuplicateDetection(
                items,
                scanAbortRef.current?.signal ?? new AbortController().signal,
                result.requestId
              )
            } else {
              patchScanCheckpoint({
                status: "error",
                error: result.error || "Scan failed",
                message: result.error || "Scan failed"
              })
              setResumeCheckpoint(scanCheckpointRef.current)
              dispatch({
                type: "SCAN_ERROR",
                error: result.error || "Scan failed"
              })
            }
          } else if (result.command === "trashItems") {
            const data = result.data as
              | {
                  trashedKeys?: string[]
                  trashedDedupKeys?: string[]
                  trashedCount?: number
                  partial?: boolean
                  retryAttempts?: number
                }
              | undefined
            if (result.success) {
              const attemptedMediaKeys =
                pendingMediaKeysToTrashRef.current ?? data?.trashedKeys ?? []
              const attemptedDedupKeys =
                pendingDedupKeysRef.current ?? data?.trashedDedupKeys ?? []
              const trashedKeys = data?.trashedKeys ?? attemptedMediaKeys
              const trashedDedupKeys =
                data?.trashedDedupKeys ?? attemptedDedupKeys
              saveTrashResultReport(
                buildTrashResultReport({
                  attemptedMediaKeys,
                  attemptedDedupKeys,
                  movedMediaKeys: trashedKeys,
                  movedDedupKeys: trashedDedupKeys,
                  retryAttempts: data?.retryAttempts
                })
              )
              dispatch({ type: "TRASH_COMPLETE", trashedKeys })
              // Set undo data from the snapshot captured before trash
              if (preTrashSnapshotRef.current && pendingDedupKeysRef.current) {
                setUndoData({
                  dedupKeys: trashedDedupKeys,
                  count:
                    trashedKeys.length || pendingDedupKeysRef.current.length,
                  snapshot: preTrashSnapshotRef.current
                })
              }
              preTrashSnapshotRef.current = null
              pendingDedupKeysRef.current = null
              pendingMediaKeysToTrashRef.current = null
            } else {
              const attemptedMediaKeys =
                pendingMediaKeysToTrashRef.current ?? data?.trashedKeys ?? []
              const attemptedDedupKeys =
                pendingDedupKeysRef.current ?? data?.trashedDedupKeys ?? []
              const trashedKeys = data?.trashedKeys ?? []
              const trashedDedupKeys = data?.trashedDedupKeys ?? []
              saveTrashResultReport(
                buildTrashResultReport({
                  attemptedMediaKeys,
                  attemptedDedupKeys,
                  movedMediaKeys: trashedKeys,
                  movedDedupKeys: trashedDedupKeys,
                  retryAttempts: data?.retryAttempts,
                  error: result.error || "Trash failed"
                })
              )
              if (data?.partial && trashedKeys.length > 0) {
                dispatch({ type: "TRASH_COMPLETE", trashedKeys })
                if (preTrashSnapshotRef.current && trashedDedupKeys.length) {
                  setUndoData({
                    dedupKeys: trashedDedupKeys,
                    count: trashedDedupKeys.length,
                    snapshot: preTrashSnapshotRef.current
                  })
                }
                setTrashWarning(
                  `Moved ${trashedKeys.length.toLocaleString()} item${
                    trashedKeys.length !== 1 ? "s" : ""
                  } before trash failed: ${result.error || "Trash failed"}`
                )
                preTrashSnapshotRef.current = null
                pendingDedupKeysRef.current = null
                pendingMediaKeysToTrashRef.current = null
                break
              }
              preTrashSnapshotRef.current = null
              pendingDedupKeysRef.current = null
              pendingMediaKeysToTrashRef.current = null
              dispatch({
                type: "TRASH_ERROR",
                error: result.error || "Trash failed"
              })
            }
          } else if (result.command === "restoreItems") {
            if (result.requestId !== pendingRestoreRequestIdRef.current) {
              break
            }
            const pendingUndo = pendingRestoreUndoRef.current
            pendingRestoreUndoRef.current = null
            pendingRestoreRequestIdRef.current = null
            if (!result.success) {
              console.error("GPD: Restore failed:", result.error)
              if (pendingUndo) {
                setUndoData(pendingUndo)
                setTrashWarning(
                  `Restore failed: ${result.error || "Google Photos could not restore the moved items."}`
                )
              }
            }
          }
          break
        }
        case "gptkLog":
          if ((message as { level?: string }).level === "error") {
            dispatch({ type: "GP_TAB_CLOSED" })
          }
          break
        case "gptkProgress": {
          const progress = message as GptkProgressMessage
          if (progress.command === "trashItems") {
            const data = progress.data as
              | {
                  trashedKeys?: string[]
                  trashedDedupKeys?: string[]
                }
              | undefined
            console.log(`[GPD] trash progress: ${progress.itemsProcessed}`)
            dispatch({
              type: "TRASH_PROGRESS",
              trashedSoFar: progress.itemsProcessed,
              trashedKeys: data?.trashedKeys
            })
          } else if (progress.command === "restoreItems") {
            console.log(`[GPD] restore progress: ${progress.itemsProcessed}`)
          } else {
            patchScanCheckpoint({
              phase: "fetching",
              itemsProcessed: progress.itemsProcessed,
              message: progress.message ?? "Reading your library..."
            })
            dispatch({ type: "SCAN_PROGRESS", payload: progress })
          }
          break
        }
      }
    }

    chrome.runtime.onMessage.addListener(listener)
    return () => chrome.runtime.onMessage.removeListener(listener)
  }, [patchScanCheckpoint, saveTrashResultReport])

  // Keep refs so async callbacks always see latest values
  const settingsRef = useRef(settings)
  settingsRef.current = settings
  const stateRef = useRef(state)
  stateRef.current = state

  // Run MediaPipe duplicate detection on fetched media items
  const runDuplicateDetection = useCallback(
    async (items: GpdMediaItem[], signal: AbortSignal, requestId: string) => {
      const logger = scanLoggerRef.current
      await logger.start(items.length)
      const patchCheckpointForRequest = (
        patch: Parameters<typeof updateScanCheckpoint>[1]
      ) => {
        if (scanCheckpointRef.current?.id !== requestId) return
        patchScanCheckpoint(patch)
      }
      try {
        const onProgressCallback = (progress: DetectionProgress) => {
          if (currentScanRequestIdRef.current !== requestId) return
          patchCheckpointForRequest({
            phase: progress.phase,
            itemsProcessed: progress.current,
            totalEstimate: progress.total,
            message: `${progress.phase}: ${progress.current}/${progress.total}`
          })
          dispatch({
            type: "SCAN_PROGRESS",
            phase: progress.phase,
            totalItems: progress.total,
            payload: {
              app: APP_ID,
              action: "gptkProgress",
              requestId: "",
              itemsProcessed: progress.current,
              message: `${progress.phase}: ${progress.current}/${progress.total}`
            }
          })
        }
        const onPartialGroupsCallback = (partialGroups: DuplicateGroup[]) => {
          if (currentScanRequestIdRef.current !== requestId) return
          const partialKeys = new Set(
            partialGroups.flatMap((group) => group.mediaKeys)
          )
          const partialMediaItems: Record<string, GpdMediaItem> = {}
          for (const item of items) {
            if (partialKeys.has(item.mediaKey)) {
              partialMediaItems[item.mediaKey] = item
            }
          }
          dispatch({
            type: "SCAN_PARTIAL_RESULTS",
            mediaItems: partialMediaItems,
            groups: partialGroups,
            totalItems: items.length
          })
        }

        const groups =
          settingsRef.current.scanMode === "smart"
            ? await smartDetectDuplicates(
                items,
                settingsRef.current.similarityThreshold,
                (settingsRef.current.smartWindowSec ?? 1) * 1000,
                onProgressCallback,
                signal,
                logger,
                onPartialGroupsCallback
              )
            : await (async () => {
                const result = await fullDetectDuplicates(
                  items,
                  settingsRef.current.similarityThreshold,
                  onProgressCallback,
                  signal,
                  logger,
                  onPartialGroupsCallback
                )
                return result.groups
              })()

        await logger.finalize("complete", { groupsFound: groups.length })
        if (currentScanRequestIdRef.current !== requestId) return
        await clearScanCheckpoint()
        scanCheckpointRef.current = null
        setResumeCheckpoint(null)
        currentScanRequestIdRef.current = null

        const groupMediaKeys = new Set(groups.flatMap((g) => g.mediaKeys))
        const mediaItemMap: Record<string, GpdMediaItem> = {}
        for (const item of items) {
          if (groupMediaKeys.has(item.mediaKey)) {
            mediaItemMap[item.mediaKey] = item
          }
        }

        dispatch({
          type: "SCAN_COMPLETE",
          mediaItems: mediaItemMap,
          groups,
          totalItems: items.length
        })
        refreshEmbeddingCacheCount()
        // Refresh account email after scan — the email in state may be stale
        // if the user switched accounts since the last health check.
        sendToServiceWorker({
          app: APP_ID,
          action: "healthCheck",
          provider: settingsRef.current.sourceProvider ?? "google"
        })
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          await logger.finalize("paused")
          if (
            scanCheckpointRef.current?.id === requestId &&
            scanCheckpointRef.current.status === "active"
          ) {
            patchCheckpointForRequest({
              status: "interrupted",
              message:
                "Scan paused. Resume to reuse completed cached embeddings."
            })
            setResumeCheckpoint(scanCheckpointRef.current)
          }
          if (currentScanRequestIdRef.current === requestId) {
            currentScanRequestIdRef.current = null
            dispatch({ type: "SCAN_CANCELLED" })
          }
        } else {
          await logger.finalize("error", { error: String(error) })
          if (currentScanRequestIdRef.current !== requestId) return
          currentScanRequestIdRef.current = null
          patchCheckpointForRequest({
            status: "error",
            error: String(error),
            message: `Duplicate detection failed: ${error}`
          })
          setResumeCheckpoint(scanCheckpointRef.current)
          dispatch({
            type: "SCAN_ERROR",
            error: `Duplicate detection failed: ${error}`
          })
        }
      }
    },
    [patchScanCheckpoint, refreshEmbeddingCacheCount, requestAlbums]
  )

  // Health check on mount + recover any scan log entry orphaned by a page reload
  useEffect(() => {
    sendToServiceWorker({
      app: APP_ID,
      action: "healthCheck",
      provider: settingsRef.current.sourceProvider ?? "google"
    })
    scanLoggerRef.current.recoverStale()
    refreshEmbeddingCacheCount()
  }, [refreshEmbeddingCacheCount])

  // Load saved settings and results on mount
  useEffect(() => {
    chrome.storage.local.get(
      ["settings", "scanResults", "selections", SCAN_CHECKPOINT_KEY],
      (result: Partial<StoredState>) => {
        const checkpoint = result.scanCheckpoint
        if (checkpoint?.status === "active") {
          const interrupted = updateScanCheckpoint(checkpoint, {
            status: "interrupted",
            message:
              "Previous scan was interrupted. Resume to reuse completed cached embeddings."
          })
          scanCheckpointRef.current = interrupted
          setResumeCheckpoint(interrupted)
          void persistScanCheckpoint(interrupted)
        } else if (shouldOfferResume(checkpoint)) {
          scanCheckpointRef.current = checkpoint
          setResumeCheckpoint(checkpoint)
        }
        const storedSettings = result.settings
          ? normalizeStoredSettings(result.settings)
          : settingsRef.current
        if (result.settings) {
          settingsRef.current = storedSettings
          setSettings(storedSettings)
        }
        const currentAccountEmail = currentAccountEmailRef.current
        const savedResultsAreForCurrentAccount =
          !result.scanResults ||
          currentAccountEmail === undefined ||
          areScanResultsValid(result.scanResults, {
            accountEmail: currentAccountEmail,
            sourceProvider: storedSettings.sourceProvider ?? "google"
          })
        if (!savedResultsAreForCurrentAccount) {
          pendingSelectionsRef.current = null
          chrome.storage.local.remove(["scanResults", "selections"])
          setStorageChecked(true)
          return
        }
        if (result.selections) {
          // Store deserialized selections before dispatching LOAD_SAVED_RESULTS so
          // the groups-change effect can apply them when groups first appear.
          const saved = deserializeStoredSelections(result.selections)
          if (result.scanResults?.groups) {
            const validGroups = new Map(
              result.scanResults.groups.map((group) => [group.id, group])
            )
            const selectedGroupIds = new Set(
              [...saved.selectedGroupIds].filter((id) => validGroups.has(id))
            )
            const keptOverrides: Record<string, Set<string>> = {}
            for (const [id, keys] of Object.entries(saved.keptOverrides)) {
              const group = validGroups.get(id)
              if (!group) continue
              const validKeys = new Set(group.mediaKeys)
              const filteredKeys = [...keys].filter((key) => validKeys.has(key))
              if (keys.size === 0 || filteredKeys.length > 0) {
                keptOverrides[id] = new Set(filteredKeys)
              }
            }
            pendingSelectionsRef.current = {
              selectedGroupIds,
              keptOverrides
            }
            chrome.storage.local.set({
              selections: {
                selectedGroupIds: [...selectedGroupIds],
                keptOverrides: Object.fromEntries(
                  Object.entries(keptOverrides).map(([id, keys]) => [
                    id,
                    [...keys]
                  ])
                )
              }
            })
          } else {
            pendingSelectionsRef.current = saved
          }
        }
        if (
          result.scanResults?.totalItems &&
          Array.isArray(result.scanResults.groups)
        ) {
          dispatch({
            type: "LOAD_SAVED_RESULTS",
            mediaItems: result.scanResults.mediaItems,
            groups: result.scanResults.groups,
            totalItems: result.scanResults.totalItems,
            accountEmail: result.scanResults.accountEmail
          })
        }
        setStorageChecked(true)
      }
    )
  }, [])

  // Persist scan results when they change (after scan or trash)
  const mediaItems =
    state.status === "results" || state.status === "trashing"
      ? state.mediaItems
      : null

  const groupClassificationById = useMemo(() => {
    const m = new Map<string, "exact" | "similar">()
    if (Object.keys(displayMediaItems).length === 0) return m
    for (const group of groups) {
      m.set(
        group.id,
        group.duplicateKind ??
          classifyDuplicateGroup(group, displayMediaItems).duplicateKind
      )
    }
    return m
  }, [groups, displayMediaItems])

  const exactGroupCount = useMemo(
    () =>
      groups.reduce(
        (count, group) =>
          count + (groupClassificationById.get(group.id) === "exact" ? 1 : 0),
        0
      ),
    [groups, groupClassificationById]
  )
  const similarGroupCount = groups.length - exactGroupCount
  const visibleGroups = useMemo(() => {
    if (reviewFilter === "all") return groups
    return groups.filter(
      (group) => groupClassificationById.get(group.id) === reviewFilter
    )
  }, [groups, groupClassificationById, reviewFilter])
  const provisionalGroups = state.status === "scanning" ? groups : visibleGroups

  const handleSelectAll = useCallback(() => {
    setSelectedGroupIds((prev) => {
      const next = new Set(prev)
      for (const group of visibleGroups) next.add(group.id)
      return next
    })
  }, [visibleGroups])

  const handleDeselectAll = useCallback(() => {
    setSelectedGroupIds((prev) => {
      const next = new Set(prev)
      for (const group of visibleGroups) next.delete(group.id)
      return next
    })
  }, [visibleGroups])

  // Stable default kept sets (one per group, only changes when groups or media items change).
  // Uses smart keep selection: original quality > oldest taken date > higher resolution.
  const defaultKeptSets = useMemo(() => {
    const m = new Map<string, Set<string>>()
    for (const g of groups) {
      const groupItems = g.mediaKeys
        .map((k) => displayMediaItems[k])
        .filter(Boolean)
      const defaultKey =
        groupItems.length > 0
          ? selectDefaultKeep(groupItems)
          : g.originalMediaKey
      m.set(g.id, new Set([defaultKey]))
    }
    return m
  }, [groups, displayMediaItems])

  const getKept = useCallback(
    (group: DuplicateGroup): Set<string> =>
      keptOverrides[group.id] ??
      defaultKeptSets.get(group.id) ??
      new Set([group.originalMediaKey]),
    [keptOverrides, defaultKeptSets]
  )

  const buildCurrentReviewReport = useCallback(() => {
    const currentState = stateRef.current
    if (currentState.status !== "results") return null
    return buildReviewReport({
      groups: visibleGroups,
      mediaItems: currentState.mediaItems,
      selectedGroupIds,
      getKept
    })
  }, [getKept, selectedGroupIds, visibleGroups])

  const handleExportJson = useCallback(() => {
    const report = buildCurrentReviewReport()
    if (!report) return
    downloadTextFile({
      filename: `${report.reportId}.json`,
      contents: JSON.stringify(report, null, 2),
      type: "application/json"
    })
  }, [buildCurrentReviewReport])

  const handleExportCsv = useCallback(() => {
    const report = buildCurrentReviewReport()
    if (!report) return
    downloadTextFile({
      filename: `${report.reportId}.csv`,
      contents: reviewReportToCsv(report),
      type: "text/csv"
    })
  }, [buildCurrentReviewReport])

  // Per-group kept sets: overridden groups use the live override Set (changes only for
  // the toggled group); unoverridden groups reuse the stable default Set from above so
  // React.memo on DuplicateGroupRow skips re-renders for unaffected rows.
  const keptByGroupId = useMemo(() => {
    const m = new Map<string, Set<string>>()
    for (const g of groups) {
      m.set(g.id, keptOverrides[g.id] ?? defaultKeptSets.get(g.id)!)
    }
    return m
  }, [groups, keptOverrides, defaultKeptSets])

  const handleToggleKept = useCallback(
    (group: DuplicateGroup, mediaKey: string) => {
      setKeptOverrides((prev) => {
        const current =
          prev[group.id] ??
          defaultKeptSets.get(group.id) ??
          new Set([group.originalMediaKey])
        // Prevent removing the last kept item
        if (current.has(mediaKey) && current.size === 1) return prev
        const next = new Set(current)
        if (next.has(mediaKey)) {
          next.delete(mediaKey)
        } else {
          next.add(mediaKey)
        }
        return { ...prev, [group.id]: next }
      })
    },
    [defaultKeptSets]
  )

  const handleTrashAllCopies = useCallback((group: DuplicateGroup) => {
    setSelectedGroupIds((prev) => {
      if (prev.has(group.id)) return prev
      const next = new Set(prev)
      next.add(group.id)
      return next
    })
    setKeptOverrides((prev) => ({ ...prev, [group.id]: new Set() }))
  }, [])

  const handleApplyKeepStrategy = useCallback(
    (strategy: KeepStrategy) => {
      if (!mediaItems) return
      setKeptOverrides((prev) => {
        const next: Record<string, Set<string>> = { ...prev }
        for (const group of visibleGroups) {
          const keepKey = chooseKeepKeyForGroup(group, mediaItems, strategy)
          if (keepKey) next[group.id] = new Set([keepKey])
        }
        return next
      })
    },
    [mediaItems, visibleGroups]
  )
  const totalItems =
    state.status === "results" || state.status === "trashing"
      ? state.totalItems
      : 0
  const accountEmailForStorage =
    state.status === "results" || state.status === "trashing"
      ? state.accountEmail
      : undefined
  useEffect(() => {
    if (!accountValidationComplete) return
    if (!mediaItems) return
    if (groups.length > 0) {
      const storedMediaItemCount = Object.keys(mediaItems).length
      const mediaItemsAreComplete = storedMediaItemCount === totalItems
      const newestCreationTimestamp = mediaItemsAreComplete
        ? Object.values(mediaItems).reduce(
            (max, item) => Math.max(max, item.creationTimestamp ?? 0),
            0
          )
        : undefined
      chrome.storage.local.set({
        scanResults: {
          mediaItems,
          groups,
          scanDate: Date.now(),
          totalItems,
          newestCreationTimestamp,
          mediaItemsAreComplete,
          accountEmail: accountEmailForStorage,
          sourceProvider: settings.sourceProvider ?? "google",
          dateRange: activeDateRange(settings.dateRange),
          albumScope:
            (settings.sourceProvider ?? "google") === "google"
              ? activeAlbumScope(settings.albumScope)
              : undefined
        }
      })
    } else {
      // All duplicates removed — clear saved results so next open starts fresh
      chrome.storage.local.remove("scanResults")
    }
  }, [
    groups,
    mediaItems,
    totalItems,
    accountEmailForStorage,
    accountValidationComplete,
    settings.dateRange,
    settings.albumScope
  ])

  // Persist selections when they change (only while results are showing)
  useEffect(() => {
    const canPersistSelections =
      accountValidationComplete ||
      (!accountEmailForStorage && currentAccountEmailRef.current === undefined)
    if (!canPersistSelections) return
    if (state.status !== "results") return
    if (groups.length === 0) {
      chrome.storage.local.remove("selections")
      return
    }
    const validGroups = new Map(groups.map((group) => [group.id, group]))
    const validSelectedGroupIds = [...selectedGroupIds].filter((id) =>
      validGroups.has(id)
    )
    const validKeptOverrides: Record<string, string[]> = {}
    for (const [id, keys] of Object.entries(keptOverrides)) {
      const group = validGroups.get(id)
      if (!group) continue
      const validKeys = new Set(group.mediaKeys)
      const filteredKeys = [...keys].filter((key) => validKeys.has(key))
      if (keys.size === 0 || filteredKeys.length > 0) {
        validKeptOverrides[id] = filteredKeys
      }
    }
    chrome.storage.local.set({
      selections: {
        selectedGroupIds: validSelectedGroupIds,
        keptOverrides: validKeptOverrides
      }
    })
  }, [
    selectedGroupIds,
    keptOverrides,
    state.status,
    groups,
    accountEmailForStorage,
    accountValidationComplete
  ])

  // Save settings on change
  useEffect(() => {
    chrome.storage.local.set({ settings })
  }, [settings])

  useEffect(() => {
    setAlbums([])
    setAlbumsError(null)
    setAlbumsLoading(false)
    albumsRequestedForAccountRef.current = null
    healthCheckAttemptsRef.current = 0
    sendToServiceWorker({
      app: APP_ID,
      action: "healthCheck",
      provider: settings.sourceProvider ?? "google"
    })
  }, [settings.sourceProvider])

  const handleStartScan = useCallback(
    async (settingsOverride?: ScanSettings) => {
      const scanSettings = settingsOverride ?? settings
      settingsRef.current = scanSettings
      if (settingsOverride) {
        setSettings(fullScanSettingsPatch(scanSettings))
        await chrome.storage.local.set({ settings: scanSettings })
      }

      // Cancel any in-progress scan
      scanAbortRef.current?.abort()
      scanAbortRef.current = new AbortController()

      const requestId = generateRequestId()
      currentScanRequestIdRef.current = requestId
      const currentState = stateRef.current
      const hasGptk =
        currentState.status === "connected" ? currentState.hasGptk : true
      const accountEmail =
        currentState.status === "connected" || currentState.status === "results"
          ? currentState.accountEmail
          : undefined
      const checkpoint = createScanCheckpoint({
        id: requestId,
        settings: scanSettings,
        accountEmail
      })
      scanCheckpointRef.current = checkpoint
      setResumeCheckpoint(null)
      void persistScanCheckpoint(checkpoint)

      dispatch({ type: "SCAN_STARTED", requestId, hasGptk, accountEmail })

      console.log(
        `[GPD] starting scan: mode=${scanSettings.scanMode}, threshold=${scanSettings.similarityThreshold}`
      )

      // Load cached media items for incremental fetch. Scoped scans avoid the
      // incremental cache so a year/month result cannot poison a later full scan.
      cachedMediaItemsRef.current = null
      let sinceTimestamp: number | undefined
      const dateRange = activeDateRange(scanSettings.dateRange)
      const sourceProvider = scanSettings.sourceProvider ?? "google"
      const albumScope =
        sourceProvider === "google"
          ? activeAlbumScope(scanSettings.albumScope)
          : undefined
      try {
        const stored = (await chrome.storage.local.get(
          "scanResults"
        )) as Partial<StoredState>
        const prev = stored.scanResults
        if (
          !dateRange &&
          !albumScope &&
          (prev?.sourceProvider ?? "google") === sourceProvider &&
          !prev?.dateRange &&
          !prev?.albumScope &&
          prev?.mediaItems &&
          Object.keys(prev.mediaItems).length > 0 &&
          prev.mediaItemsAreComplete !== false &&
          Object.keys(prev.mediaItems).length === prev.totalItems &&
          areScanResultsValid(prev, { accountEmail, sourceProvider })
        ) {
          cachedMediaItemsRef.current = prev.mediaItems
          // Compute watermark if not stored (migration: first run after this deploy)
          sinceTimestamp =
            prev.newestCreationTimestamp ??
            Object.values(prev.mediaItems).reduce(
              (max, item) => Math.max(max, item.creationTimestamp ?? 0),
              0
            )
          console.log(
            `[GPD] media items cache: ${Object.keys(prev.mediaItems).length} items, fetching since ${new Date(sinceTimestamp).toISOString()}`
          )
        }
      } catch {
        // Cache unavailable — do full fetch
      }

      sendToServiceWorker({
        app: APP_ID,
        action: "gptkCommand",
        command: "getAllMediaItems",
        requestId,
        provider: sourceProvider,
        args: {
          dateRange,
          albumScope,
          sinceTimestamp
        }
      })
    },
    [settings]
  )

  const clearEmbeddingCache = useCallback(async (): Promise<number | null> => {
    let cache: EmbeddingCache | null = null
    try {
      cache = await EmbeddingCache.open()
      const before = await cache.count()
      await cache.clear()
      setCacheEntryCount(0)
      return before
    } finally {
      cache?.close()
    }
  }, [])

  const handleClearCache = useCallback(async () => {
    setCacheBusy(true)
    setCacheStatus(undefined)
    try {
      const removed = await clearEmbeddingCache()
      setCacheStatus(
        `Cleared ${(removed ?? 0).toLocaleString()} cached embedding${
          removed !== 1 ? "s" : ""
        }.`
      )
    } catch (error) {
      setCacheStatus(
        `Could not clear cache: ${error instanceof Error ? error.message : String(error)}`
      )
      await refreshEmbeddingCacheCount()
    } finally {
      setCacheBusy(false)
    }
  }, [clearEmbeddingCache, refreshEmbeddingCacheCount])

  const handleRebuildCache = useCallback(async () => {
    setCacheBusy(true)
    setCacheStatus(undefined)
    try {
      const removed = await clearEmbeddingCache()
      setCacheStatus(
        `Cleared ${(removed ?? 0).toLocaleString()} cached embedding${
          removed !== 1 ? "s" : ""
        }. Rebuilding on the next scan.`
      )
    } catch (error) {
      setCacheStatus(
        `Could not rebuild cache: ${error instanceof Error ? error.message : String(error)}`
      )
      setCacheBusy(false)
      await refreshEmbeddingCacheCount()
      return
    }
    setCacheBusy(false)
    handleStartScan()
  }, [clearEmbeddingCache, handleStartScan, refreshEmbeddingCacheCount])

  const handleExportCacheDiagnostics = useCallback(async () => {
    setCacheBusy(true)
    setCacheStatus(undefined)
    let cache: EmbeddingCache | null = null
    try {
      cache = await EmbeddingCache.open()
      const records = await cache.allRecords()
      const report = buildCacheDiagnosticsReport(records)
      downloadTextFile({
        filename: `${report.reportId}.json`,
        contents: JSON.stringify(report, null, 2),
        type: "application/json"
      })
      setCacheStatus(
        `Exported diagnostics for ${report.totalRecords.toLocaleString()} cached embedding${
          report.totalRecords !== 1 ? "s" : ""
        }.`
      )
    } catch (error) {
      setCacheStatus(
        `Could not export cache diagnostics: ${error instanceof Error ? error.message : String(error)}`
      )
    } finally {
      cache?.close()
      setCacheBusy(false)
    }
  }, [])

  const handleResumeScan = useCallback(() => {
    if (!resumeCheckpoint) return
    const currentState = stateRef.current
    const accountEmail =
      currentState.status === "connected" || currentState.status === "results"
        ? currentState.accountEmail
        : resumeCheckpoint.accountEmail

    if (!canResumeScanCheckpoint(resumeCheckpoint, { accountEmail })) {
      clearResumeCheckpointState({
        checkpointRef: scanCheckpointRef,
        setResumeCheckpoint
      })
      return
    }

    const checkpointItems = resumeCheckpoint.mediaItems
    if (checkpointItems && checkpointItems.length > 0) {
      const scanSettings = resumeCheckpoint.settings
      settingsRef.current = scanSettings
      setSettings(fullScanSettingsPatch(scanSettings))
      void chrome.storage.local.set({ settings: scanSettings })

      scanAbortRef.current?.abort()
      scanAbortRef.current = new AbortController()

      const requestId = generateRequestId()
      currentScanRequestIdRef.current = requestId
      const hasGptk =
        currentState.status === "connected" ? currentState.hasGptk : true

      const resumedCheckpoint = updateScanCheckpoint(
        {
          ...resumeCheckpoint,
          id: requestId,
          status: "active"
        },
        {
          phase: "downloading_thumbnails",
          itemsProcessed: 0,
          totalEstimate: checkpointItems.length,
          message: `Resuming duplicate detection for ${checkpointItems.length.toLocaleString()} fetched items...`
        }
      )
      scanCheckpointRef.current = resumedCheckpoint
      setResumeCheckpoint(null)
      void persistScanCheckpoint(resumedCheckpoint)

      dispatch({ type: "SCAN_STARTED", requestId, hasGptk, accountEmail })
      dispatch({ type: "SCAN_MEDIA_FETCHED", mediaItems: checkpointItems })
      runDuplicateDetection(
        checkpointItems,
        scanAbortRef.current.signal,
        requestId
      )
      return
    }
    handleStartScan(resumeCheckpoint.settings)
  }, [handleStartScan, resumeCheckpoint, runDuplicateDetection])

  const handleDismissResume = useCallback(() => {
    setResumeCheckpoint(null)
    scanCheckpointRef.current = null
    void clearScanCheckpoint()
  }, [])

  const handleTrash = useCallback(() => {
    if (state.status !== "results") return
    const hasIcloudItems = Object.values(state.mediaItems).some(
      (item) => item.provider === "icloud"
    )
    if (hasIcloudItems) {
      setTrashWarning(
        "Trash is not available for iCloud Photos yet. Review and export the duplicate report instead."
      )
      return
    }

    const dedupKeys: string[] = []
    const mediaKeysToTrash: string[] = []
    for (const group of visibleGroups) {
      if (!selectedGroupIds.has(group.id)) continue
      const keptSet = getKept(group)
      for (const key of group.mediaKeys) {
        if (keptSet.has(key)) continue
        const item = state.mediaItems[key]
        if (item?.dedupKey) {
          dedupKeys.push(item.dedupKey)
          mediaKeysToTrash.push(key)
        }
      }
    }

    if (dedupKeys.length === 0) return
    setTrashConfirmCount("")
    setTrashConfirm({ dedupKeys, mediaKeysToTrash })
  }, [state, selectedGroupIds, getKept, visibleGroups])

  const handleCloseTrashConfirm = useCallback(() => {
    setTrashConfirm(null)
    setTrashConfirmCount("")
  }, [])

  const handleTrashConfirmed = useCallback(async () => {
    if (!trashConfirm || state.status !== "results") return
    const { dedupKeys, mediaKeysToTrash } = trashConfirm
    setReportError(null)

    const deleteReport = buildDeleteReport({
      groups: visibleGroups,
      mediaItems: state.mediaItems,
      selectedGroupIds,
      getKept,
      mediaKeysToTrash,
      trashBatchSize: TRASH_BATCH_SIZE
    })
    try {
      await persistDeleteReport(deleteReport)
      downloadDeleteReport(deleteReport)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setReportError(`Could not save the pre-trash report: ${message}`)
      return
    }

    handleCloseTrashConfirm()
    setTrashWarning(null)

    const requestId = generateRequestId()

    // Capture snapshot for undo
    preTrashSnapshotRef.current = {
      mediaItems: state.mediaItems,
      groups: state.groups,
      totalItems: state.totalItems
    }
    pendingDedupKeysRef.current = dedupKeys
    pendingMediaKeysToTrashRef.current = mediaKeysToTrash

    dispatch({
      type: "TRASH_STARTED",
      totalToTrash: dedupKeys.length,
      mediaItems: state.mediaItems,
      groups: state.groups,
      totalItems: state.totalItems
    })

    sendToServiceWorker({
      app: APP_ID,
      action: "gptkCommand",
      command: "trashItems",
      requestId,
      args: {
        dedupKeys,
        mediaKeysToTrash,
        batchSize: TRASH_BATCH_SIZE,
        batchPauseMs: TRASH_BATCH_PAUSE_MS,
        retryCount: TRASH_RETRY_COUNT,
        retryBackoffMs: TRASH_RETRY_BACKOFF_MS
      }
    })
  }, [
    trashConfirm,
    state,
    selectedGroupIds,
    getKept,
    visibleGroups,
    handleCloseTrashConfirm
  ])

  const handlePauseScan = useCallback(() => {
    const checkpoint = scanCheckpointRef.current
    if (checkpoint?.status === "active") {
      const paused = updateScanCheckpoint(checkpoint, {
        status: "interrupted",
        message: "Scan paused. Resume to reuse completed cached embeddings."
      })
      scanCheckpointRef.current = paused
      setResumeCheckpoint(paused)
      void persistScanCheckpoint(paused)
    }
    scanAbortRef.current?.abort()
    currentScanRequestIdRef.current = null
    dispatch({ type: "SCAN_CANCELLED" })
  }, [])

  const handleReset = useCallback(() => {
    scanAbortRef.current?.abort()
    scanAbortRef.current = null
    currentScanRequestIdRef.current = null
    scanCheckpointRef.current = null
    cachedMediaItemsRef.current = null
    pendingSelectionsRef.current = null
    preTrashSnapshotRef.current = null
    pendingDedupKeysRef.current = null
    pendingMediaKeysToTrashRef.current = null
    pendingRestoreUndoRef.current = null
    pendingRestoreRequestIdRef.current = null
    setResumeCheckpoint(null)
    setSelectedGroupIds(new Set())
    setKeptOverrides({})
    setTrashConfirm(null)
    setTrashConfirmCount("")
    setTrashWarning(null)
    setReportError(null)
    setUndoData(null)
    void chrome.storage.local.remove([
      "scanResults",
      "selections",
      SCAN_CHECKPOINT_KEY
    ])
    dispatch({ type: "RESET" })
    healthCheckAttemptsRef.current = 0
    sendToServiceWorker({
      app: APP_ID,
      action: "healthCheck",
      provider: settingsRef.current.sourceProvider ?? "google"
    })
  }, [])

  const handleUndo = useCallback(() => {
    if (!undoData) return
    const requestId = generateRequestId()
    pendingRestoreUndoRef.current = undoData
    pendingRestoreRequestIdRef.current = requestId
    // Optimistically restore the UI to the pre-trash state
    dispatch({
      type: "RESTORE_SNAPSHOT",
      mediaItems: undoData.snapshot.mediaItems,
      groups: undoData.snapshot.groups,
      totalItems: undoData.snapshot.totalItems
    })
    // Call GPTK to restore from trash
    sendToServiceWorker({
      app: APP_ID,
      action: "gptkCommand",
      command: "restoreItems",
      requestId,
      args: { dedupKeys: undoData.dedupKeys }
    })
    setUndoData(null)
    setTrashWarning(null)
  }, [undoData])

  const handleUndoClose = useCallback(() => {
    setUndoData(null)
  }, [])

  // Fire confetti when trash completes
  useEffect(() => {
    if (!undoData) return
    confetti({
      particleCount: 200,
      spread: 100,
      origin: { y: 0.7 }
    })
  }, [undoData])

  // Compute duplicate count for ActionBar
  const duplicateCount =
    state.status === "results"
      ? visibleGroups.reduce((sum, group) => {
          if (!selectedGroupIds.has(group.id)) return sum
          const keptSet = keptByGroupId.get(group.id)!
          return sum + group.mediaKeys.filter((k) => !keptSet.has(k)).length
        }, 0)
      : 0
  const workflowStage =
    state.status === "scanning"
      ? "scan"
      : state.status === "results"
        ? groups.length > 0
          ? "review"
          : "done"
        : state.status === "trashing"
          ? "trash"
          : "setup"
  const workflowTotalItems =
    state.status === "results" || state.status === "trashing"
      ? state.totalItems
      : state.status === "scanning"
        ? state.partialTotalItems ?? state.totalEstimate
        : 0
  const workflowGroups =
    state.status === "results" || state.status === "trashing"
      ? groups
      : state.status === "scanning"
        ? state.partialGroups ?? []
        : []
  const workflowExactGroupCount = workflowGroups.filter((group) => {
    if (group.duplicateKind === "exact" || group.duplicateKind === "similar") {
      return group.duplicateKind === "exact"
    }
    return (
      Object.keys(displayMediaItems).length > 0 &&
      classifyDuplicateGroup(group, displayMediaItems).duplicateKind === "exact"
    )
  }).length
  const workflowSimilarGroupCount =
    workflowGroups.length - workflowExactGroupCount
  const workflowDuplicateCount =
    state.status === "trashing"
      ? Math.max(0, state.totalToTrash - state.trashedSoFar)
      : duplicateCount
  const workflowScanDetail =
    state.status === "scanning"
      ? state.totalEstimate > 0
        ? `${state.itemsProcessed.toLocaleString()} of ${state.totalEstimate.toLocaleString()}`
        : `${state.itemsProcessed.toLocaleString()} checked`
      : undefined

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />

      <AppBar position="sticky" elevation={0}>
        <Toolbar sx={{ minHeight: 56, gap: 1.25 }}>
          <PhotoLibraryRoundedIcon color="primary" />
          <Typography variant="h6" fontWeight={700} sx={{ flexGrow: 1 }}>
            Google Photos Deduper
          </Typography>
          {"accountEmail" in state && state.accountEmail && (
            <Typography
              variant="body2"
              color="text.secondary"
              noWrap
              sx={{ maxWidth: { xs: 150, sm: "none" } }}>
              Signed in as {state.accountEmail}
            </Typography>
          )}
        </Toolbar>
      </AppBar>

      {/* Main content */}
      <Box
        component="main"
        sx={{
          maxWidth:
            state.status === "results" && groups.length > 0 ? 1500 : 1200,
          mx: "auto",
          px: { xs: 2, md: 3 },
          py: { xs: 2, md: 3 },
          minHeight: "calc(100vh - 64px)"
        }}>
        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "column", md: "row" },
            gap: 2.5,
            alignItems: "flex-start"
          }}>
          <WorkflowRail
            stage={workflowStage}
            totalItems={workflowTotalItems}
            totalGroupCount={workflowGroups.length}
            exactGroupCount={workflowExactGroupCount}
            similarGroupCount={workflowSimilarGroupCount}
            duplicateCount={workflowDuplicateCount}
            scanDetail={workflowScanDetail}
            onRescan={handleReset}
          />

          <Box sx={{ minWidth: 0, flex: 1, width: "100%" }}>
            {state.status === "connecting" && (
              <Box sx={{ display: "flex", justifyContent: "center", pt: 10 }}>
                <CircularProgress disableShrink />
              </Box>
            )}

            {state.status === "disconnected" && (
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  pt: 8,
                  gap: 2
                }}>
                <Alert severity="error" sx={{ maxWidth: 480, width: "100%" }}>
                  {state.error}
                </Alert>
                <Box sx={{ display: "flex", gap: 1 }}>
                  <Button
                    variant="contained"
                    href={providerUrl(settings.sourceProvider)}
                    target="_blank"
                    rel="noopener noreferrer">
                    Open {providerLabel(settings.sourceProvider)}
                  </Button>
                  {(settings.sourceProvider ?? "google") !== "icloud" && (
                    <Button
                      variant="outlined"
                      onClick={() =>
                        setSettings({
                          sourceProvider: "icloud",
                          albumScope: undefined
                        })
                      }>
                      Use iCloud Photos
                    </Button>
                  )}
                  {(settings.sourceProvider ?? "google") !== "google" && (
                    <Button
                      variant="outlined"
                      onClick={() =>
                        setSettings({
                          sourceProvider: "google"
                        })
                      }>
                      Use Google Photos
                    </Button>
                  )}
                  <Button variant="outlined" onClick={handleReset}>
                    Retry Connection
                  </Button>
                </Box>
                <Typography variant="caption" color="text.secondary">
                  Return here once {providerLabel(settings.sourceProvider)} is
                  open and you're signed in.
                </Typography>
              </Box>
            )}

            {state.status === "connected" && (
              <ScanConfig
                settings={settings}
                onSettingsChange={setSettings}
                onStartScan={handleStartScan}
                onResumeScan={handleResumeScan}
                onDismissResume={handleDismissResume}
                onClearCache={handleClearCache}
                onRebuildCache={handleRebuildCache}
                onExportCacheDiagnostics={handleExportCacheDiagnostics}
                hasGptk={state.hasGptk}
                cacheEntryCount={cacheEntryCount}
                cacheStatus={cacheStatus}
                cacheBusy={cacheBusy}
                resumeCheckpoint={resumeCheckpoint}
                albums={albums}
                albumsLoading={albumsLoading}
                albumsError={albumsError}
                onRefreshAlbums={() => requestAlbums(state.accountEmail)}
              />
            )}

            {state.status === "scanning" && (
              <>
                <ScanProgress
                  phase={state.phase}
                  itemsProcessed={state.itemsProcessed}
                  totalEstimate={state.totalEstimate}
                  message={state.message}
                  onPause={handlePauseScan}
                />
                {provisionalGroups.length > 0 && (
                  <Box sx={{ mt: 3 }}>
                    <Alert severity="info" sx={{ mb: 2 }}>
                      Showing possible duplicate sets while the scan continues.
                      Trash actions unlock after the scan completes.
                    </Alert>
                    <DuplicateGroups
                      groups={provisionalGroups}
                      mediaItems={displayMediaItems}
                      selectedGroupIds={new Set()}
                      onToggleGroup={() => {}}
                      keptByGroupId={keptByGroupId}
                      onToggleKept={() => {}}
                      onTrashAll={() => {}}
                      readOnly
                      heading={`${provisionalGroups.length} Possible Duplicate Set${provisionalGroups.length !== 1 ? "s" : ""}`}
                    />
                  </Box>
                )}
              </>
            )}

            {state.status === "results" &&
              groups.length === 0 &&
              storageChecked && (
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    pt: 8,
                    gap: 2
                  }}>
                  <Typography variant="h6" color="text.secondary">
                    No duplicates found in your library.
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    For reuploads or copies taken years apart, use Full scan and
                    move match sensitivity toward More matches.
                  </Typography>
                  <Button variant="contained" onClick={handleReset}>
                    Change scan settings
                  </Button>
                </Box>
              )}

            {state.status === "results" && groups.length > 0 && (
              <>
                <ActionBar
                  totalItems={state.totalItems}
                  groupCount={visibleGroups.length}
                  totalGroupCount={groups.length}
                  exactGroupCount={exactGroupCount}
                  similarGroupCount={similarGroupCount}
                  duplicateCount={duplicateCount}
                  reviewFilter={reviewFilter}
                  onReviewFilterChange={setReviewFilter}
                  onSelectAll={handleSelectAll}
                  onDeselectAll={handleDeselectAll}
                  onTrash={handleTrash}
                  onRescan={handleReset}
                  onExportJson={handleExportJson}
                  onExportCsv={handleExportCsv}
                  onApplyKeepStrategy={handleApplyKeepStrategy}
                />
                <DuplicateGroups
                  groups={visibleGroups}
                  mediaItems={displayMediaItems}
                  selectedGroupIds={selectedGroupIds}
                  onToggleGroup={handleToggleGroup}
                  keptByGroupId={keptByGroupId}
                  onToggleKept={handleToggleKept}
                  onTrashAll={handleTrashAllCopies}
                />
              </>
            )}

            {state.status === "trashing" && (
              <Box sx={{ maxWidth: 480, mx: "auto", p: 4 }}>
                <Typography variant="h5" fontWeight={600} gutterBottom>
                  Moving to Trash
                </Typography>
                <Box
                  sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                  <CircularProgress size={14} thickness={5} />
                  <Typography variant="body2" color="text.secondary">
                    {state.trashedSoFar > 0
                      ? `${state.trashedSoFar.toLocaleString()} of ${state.totalToTrash.toLocaleString()} moved`
                      : "Starting..."}
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={
                    state.totalToTrash > 0
                      ? (state.trashedSoFar / state.totalToTrash) * 100
                      : 0
                  }
                />
              </Box>
            )}
          </Box>
        </Box>
      </Box>

      {/* Trash confirm dialog */}
      <Dialog open={!!trashConfirm} onClose={handleCloseTrashConfirm}>
        <DialogTitle>Move to Trash</DialogTitle>
        <DialogContent>
          {reportError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {reportError}
            </Alert>
          )}
          <DialogContentText>
            Move {trashConfirm?.dedupKeys.length} duplicate
            {trashConfirm?.dedupKeys.length !== 1 ? "s" : ""} to trash? You can
            restore them from the Google Photos trash. A JSON audit report will
            be saved before anything is moved. Items are moved in batches of{" "}
            {TRASH_BATCH_SIZE}.
          </DialogContentText>
          <TextField
            autoFocus
            fullWidth
            margin="normal"
            label={`Type ${trashConfirm?.dedupKeys.length ?? 0} to confirm`}
            value={trashConfirmCount}
            onChange={(event) => setTrashConfirmCount(event.target.value)}
            inputProps={{
              inputMode: "numeric",
              pattern: "[0-9]*"
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseTrashConfirm}>Cancel</Button>
          <Button
            onClick={handleTrashConfirmed}
            variant="contained"
            color="error"
            disabled={
              trashConfirmCount !== String(trashConfirm?.dedupKeys.length ?? "")
            }>
            Move to Trash
          </Button>
        </DialogActions>
      </Dialog>

      {/* Undo trash snackbar */}
      <Snackbar
        open={!!undoData && !trashWarning}
        autoHideDuration={null}
        onClose={handleUndoClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        message={
          undoData
            ? `${undoData.count} item${undoData.count !== 1 ? "s" : ""} moved to trash`
            : ""
        }
        action={
          <>
            <Button color="secondary" size="small" onClick={handleUndo}>
              Undo
            </Button>
            <IconButton size="small" color="inherit" onClick={handleUndoClose}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </>
        }
      />

      <Snackbar
        open={!!trashWarning}
        autoHideDuration={null}
        onClose={() => setTrashWarning(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        message={trashWarning ?? ""}
        action={
          <>
            {undoData && (
              <Button color="secondary" size="small" onClick={handleUndo}>
                Undo moved items
              </Button>
            )}
            <IconButton
              size="small"
              color="inherit"
              onClick={() => setTrashWarning(null)}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </>
        }
      />
    </ThemeProvider>
  )
}
