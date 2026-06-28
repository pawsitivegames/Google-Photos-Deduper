// Duplicate image detection using MediaPipe Image Embedder.
// Ports the Python DuplicateImageDetector to run in the browser.
//
// Pipeline:
// 1. Fetch thumbnails for media items (skipped for items with cached embeddings)
// 2. Compute L2-normalized embeddings via MediaPipe MobileNet V3
// 3. Group duplicates using fast community detection (cosine similarity)

import { classifyDuplicateItems } from "./duplicate-classifier"
import { createCachedMediaMetadata, EmbeddingCache } from "./embedding-cache"
import { chooseExactPairMetadataKeepItem } from "./keep-strategy"
import { StabilityTracker } from "./scan-log"
import type { ScanLogger } from "./scan-log"
import type { DuplicateGroup, GpdMediaItem } from "./types"

export const FULL_SCAN_BLOCK_SIZE = 1000

export function blockPairCountForItems(
  itemCount: number,
  blockSize = FULL_SCAN_BLOCK_SIZE
): number {
  if (itemCount < 2) return 0
  if (!Number.isFinite(blockSize) || blockSize < 1) {
    throw new Error(`Invalid full-scan block size: ${blockSize}`)
  }
  const blockCount = Math.ceil(itemCount / blockSize)
  return (blockCount * (blockCount + 1)) / 2
}

function compareOldestTime(
  a: number | undefined,
  b: number | undefined
): number {
  const hasA = Number.isFinite(a)
  const hasB = Number.isFinite(b)
  if (!hasA && !hasB) return 0
  if (!hasA) return 1
  if (!hasB) return -1
  return a! - b!
}

/**
 * Select the best item to keep from a duplicate group.
 * Priority: original quality > oldest taken date > higher resolution > oldest upload date.
 */
export function selectDefaultKeep(items: GpdMediaItem[]): string {
  const exactPairMetadataKeep = chooseExactPairMetadataKeepItem(items)
  if (exactPairMetadataKeep) return exactPairMetadataKeep.mediaKey

  const qualityScore = (x: GpdMediaItem) =>
    x.isOriginalQuality === true ? 2 : x.isOriginalQuality === false ? 0 : 1
  const best = [...items].sort((a, b) => {
    const qDiff = qualityScore(b) - qualityScore(a)
    if (qDiff !== 0) return qDiff
    const takenDiff = compareOldestTime(a.timestamp, b.timestamp)
    if (takenDiff !== 0) return takenDiff
    const pxDiff =
      (b.resWidth ?? 0) * (b.resHeight ?? 0) -
      (a.resWidth ?? 0) * (a.resHeight ?? 0)
    if (pxDiff !== 0) return pxDiff
    return compareOldestTime(a.creationTimestamp, b.creationTimestamp)
  })
  return best[0].mediaKey
}

const MODEL_PATH = "scripts/mobilenet_v3_large.tflite"

// Thumbnail height for embedding computation. Larger = more accurate but slower.
const THUMB_HEIGHT = 200

export interface DetectionProgress {
  phase:
    | "downloading_thumbnails"
    | "computing_embeddings"
    | "detecting_duplicates"
  current: number
  total: number
}

export interface ScanTiming {
  totalItems: number
  candidates: number
  cacheHits: number
  fetchThumbnailsMs: number
  computeEmbeddingsMs: number
  communityDetectionMs: number
  totalMs: number
}

type ProgressCallback = (progress: DetectionProgress) => void
type DuplicateGroupsCallback = (groups: DuplicateGroup[]) => void

// ============================================================
// Main entry points
// ============================================================

export async function fullDetectDuplicates(
  mediaItems: GpdMediaItem[],
  threshold: number,
  onProgress?: ProgressCallback,
  signal?: AbortSignal,
  logger?: ScanLogger,
  onPartialGroups?: DuplicateGroupsCallback
): Promise<{ groups: DuplicateGroup[]; timing: ScanTiming }> {
  const scanStart = performance.now()

  // Filter to items with thumbnails (photos only, skip videos)
  // Include items with thumbnails. Video posters work too — two copies of the
  // same clip have identical poster frames, which produce near-identical
  // embeddings.
  const candidates = mediaItems.filter((item) => item.thumb)
  console.log(
    `[GPD] detectDuplicates: ${mediaItems.length} items → ${candidates.length} candidates`
  )

  const emptyTiming = (extra: Partial<ScanTiming> = {}): ScanTiming => ({
    totalItems: mediaItems.length,
    candidates: candidates.length,
    cacheHits: 0,
    fetchThumbnailsMs: 0,
    computeEmbeddingsMs: 0,
    communityDetectionMs: 0,
    totalMs: Math.round(performance.now() - scanStart),
    ...extra
  })

  if (candidates.length < 2) return { groups: [], timing: emptyTiming() }

  const keys = candidates.map((item) => item.mediaKey)

  // Open the managed embedding cache used by the cache UI.
  let cache: EmbeddingCache | null = null
  try {
    cache = await EmbeddingCache.open()
  } catch {
    /* cache unavailable */
  }

  // Stage A: get cached key set via a single getAllKeys() call.
  // Only the set of keys is needed here — no embedding values loaded yet.
  // This tells fetchThumbnails which items to skip downloading.
  const cachedKeySet: Set<string> = cache
    ? await cache.compatibleKeys(MODEL_PATH).catch(() => new Set<string>())
    : new Set()
  const cacheHits = keys.filter((k) => cachedKeySet.has(k)).length
  console.log(
    `[GPD] embedding cache: ${cacheHits}/${candidates.length} hits, skipping thumbnails`
  )

  // Inform logger of candidates/cacheHits now that they're known.
  // Fire-and-forget — runs concurrently with thumbnail fetching.
  logger?.updateInfo({ candidates: candidates.length, cacheHits })

  // Wrap onProgress to feed stability tracking alongside the UI callback.
  const stabilityTracker = new StabilityTracker((est) =>
    logger?.recordStableEstimate(est)
  )
  const trackedProgress: ProgressCallback = (progress) => {
    onProgress?.(progress)
    stabilityTracker.update(progress.phase, progress.current, progress.total)
  }

  // Step 1: Download thumbnails — skip items whose embedding is already cached
  const t1 = performance.now()
  const blobs = await fetchThumbnails(
    candidates,
    cachedKeySet,
    trackedProgress,
    signal
  )
  const fetchThumbnailsMs = Math.round(performance.now() - t1)
  console.log(
    `[GPD] fetchThumbnails: ${candidates.length - cacheHits} items in ${fetchThumbnailsMs}ms`
  )
  await logger?.phaseComplete("fetchThumbnailsMs", fetchThumbnailsMs)

  signal?.throwIfAborted()

  // Step 2: Compute embeddings — values loaded in bulk inside computeEmbeddings
  const t2 = performance.now()
  const { embeddings, validIndices } = await computeEmbeddings(
    blobs,
    candidates,
    cache,
    cachedKeySet,
    trackedProgress,
    signal
  ).finally(() => {
    cache?.close()
    cache = null
  })
  const computeEmbeddingsMs = Math.round(performance.now() - t2)
  console.log(
    `[GPD] computeEmbeddings: ${embeddings.length} items (${cacheHits} cached) in ${computeEmbeddingsMs}ms`
  )
  await logger?.phaseComplete("computeEmbeddingsMs", computeEmbeddingsMs)

  if (embeddings.length < 2) {
    if (candidates.length >= 2) {
      throw new Error(
        `Only ${embeddings.length} of ${candidates.length} candidate items could be processed. Check your Google Photos connection and retry.`
      )
    }
    return {
      groups: [],
      timing: emptyTiming({ cacheHits, fetchThumbnailsMs, computeEmbeddingsMs })
    }
  }

  // Step 3: Community detection — runs in a worker to keep UI responsive.
  // The setTimeout(0) yield lets React flush the phase change to "detecting_duplicates"
  // before the worker is dispatched, so the UI updates before the long computation begins.
  // Progress updates come from the worker during detection.
  trackedProgress({ phase: "detecting_duplicates", current: 0, total: 0 })
  await new Promise<void>((r) => setTimeout(r, 0))
  const workerUrl = chrome.runtime.getURL("scripts/embedder-worker.js")
  const t3 = performance.now()
  const buildGroups = (indexGroups: number[][]): DuplicateGroup[] =>
    indexGroups.map((indices, i) => {
      // Sort items by upload date ascending so the oldest is first
      const items = indices
        .map((idx) => candidates[validIndices[idx]])
        .sort((a, b) => (a.creationTimestamp ?? 0) - (b.creationTimestamp ?? 0))
      const mediaKeys = items.map((item) => item.mediaKey)
      return {
        id: `group-${i}`,
        mediaKeys,
        originalMediaKey: selectDefaultKeep(items),
        similarity: threshold, // Approximate; all items are at least this similar
        ...classifyDuplicateItems(items)
      }
    })

  const indexGroups = await runCommunityDetectionInWorker(
    embeddings,
    threshold,
    workerUrl,
    trackedProgress,
    signal,
    onPartialGroups ? (groups) => onPartialGroups(buildGroups(groups)) : undefined
  )
  const communityDetectionMs = Math.round(performance.now() - t3)
  const totalMs = Math.round(performance.now() - scanStart)
  console.log(
    `[GPD] communityDetection: ${indexGroups.length} groups in ${communityDetectionMs}ms`
  )
  console.log(`[GPD] scan complete: ${totalMs}ms total`)
  await logger?.phaseComplete("communityDetectionMs", communityDetectionMs)

  // Map indices back to media items and build DuplicateGroup objects
  const groups = buildGroups(indexGroups)

  const timing: ScanTiming = {
    totalItems: mediaItems.length,
    candidates: candidates.length,
    cacheHits,
    fetchThumbnailsMs,
    computeEmbeddingsMs,
    communityDetectionMs,
    totalMs
  }

  return { groups, timing }
}

// ============================================================
// Smart scan: group by timestamp, embed subset, pairwise union-find
// ============================================================

/**
 * Group media items by their `timestamp` field (EXIF taken date).
 * Only returns buckets with ≥ 2 items.
 *
 * windowMs = 0 (default): exact timestamp match.
 * windowMs > 0: nearby items are clustered when adjacent taken timestamps are
 * within the configured window. This avoids fixed-bucket boundary misses such
 * as 999ms and 1001ms with a 1000ms window.
 *
 * Exported for unit testing.
 */
export function groupByTimestamp(
  items: GpdMediaItem[],
  windowMs = 0
): GpdMediaItem[][] {
  if (windowMs > 0) {
    const sorted = [...items]
      .filter((item) => Number.isFinite(item.timestamp))
      .sort((a, b) => a.timestamp - b.timestamp)
    const buckets: GpdMediaItem[][] = []
    let current: GpdMediaItem[] = []
    let previousTimestamp: number | null = null

    for (const item of sorted) {
      if (
        previousTimestamp === null ||
        item.timestamp - previousTimestamp <= windowMs
      ) {
        current.push(item)
      } else {
        if (current.length >= 2) buckets.push(current)
        current = [item]
      }
      previousTimestamp = item.timestamp
    }
    if (current.length >= 2) buckets.push(current)
    return buckets
  }

  const buckets = new Map<number, GpdMediaItem[]>()
  for (const item of items) {
    const key = item.timestamp
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key)!.push(item)
  }
  return [...buckets.values()].filter((g) => g.length >= 2)
}

export function shouldCompareSmartTimestamps(
  a: number,
  b: number,
  windowMs: number
): boolean {
  return windowMs <= 0 || Math.abs(a - b) <= windowMs
}

/**
 * Given a single timestamp-bucket group, compute duplicate groups using
 * pairwise cosine similarity + union-find.
 *
 * Exported for unit testing. The worker contains an equivalent inline copy.
 */
export function withinGroupDuplicates(
  groupItems: GpdMediaItem[],
  embeddingMap: Map<string, Float32Array>,
  threshold: number,
  groupIdOffset: number
): DuplicateGroup[] {
  const withEmb = groupItems
    .map((item) => ({ item, emb: embeddingMap.get(item.mediaKey) }))
    .filter((x): x is { item: GpdMediaItem; emb: Float32Array } => !!x.emb)
  if (withEmb.length < 2) return []

  // Union-Find
  const parent = withEmb.map((_, i) => i)
  const find = (x: number): number =>
    parent[x] === x ? x : (parent[x] = find(parent[x]))
  const union = (a: number, b: number) => {
    parent[find(a)] = find(b)
  }

  const dim = withEmb[0].emb.length
  for (let i = 0; i < withEmb.length; i++) {
    for (let j = i + 1; j < withEmb.length; j++) {
      let dot = 0
      for (let k = 0; k < dim; k++) dot += withEmb[i].emb[k] * withEmb[j].emb[k]
      if (dot >= threshold) union(i, j)
    }
  }

  const components = new Map<number, GpdMediaItem[]>()
  for (let i = 0; i < withEmb.length; i++) {
    const root = find(i)
    if (!components.has(root)) components.set(root, [])
    components.get(root)!.push(withEmb[i].item)
  }

  return [...components.values()]
    .filter((g) => g.length >= 2)
    .map((items, i) => {
      const sorted = [...items].sort(
        (a, b) => (a.creationTimestamp ?? 0) - (b.creationTimestamp ?? 0)
      )
      return {
        id: `group-${groupIdOffset + i}`,
        mediaKeys: sorted.map((x) => x.mediaKey),
        originalMediaKey: selectDefaultKeep(items),
        similarity: threshold,
        ...classifyDuplicateItems(items)
      }
    })
}

/**
 * Packs embeddings and bucket index arrays, sends to worker for pairwise
 * union-find detection. Returns number[][] (group index lists into embeddings[]).
 */
async function runSmartDetectionInWorker(
  embeddings: Float32Array[],
  threshold: number,
  buckets: number[][],
  timestamps: number[],
  windowMs: number,
  workerUrl: string,
  onProgress?: ProgressCallback,
  signal?: AbortSignal,
  onPartialGroups?: (groups: number[][]) => void
): Promise<number[][]> {
  const n = embeddings.length
  if (n === 0) return []
  const dim = embeddings[0].length

  const flat = new Float32Array(n * dim)
  for (let i = 0; i < n; i++) flat.set(embeddings[i], i * dim)

  const worker = new Worker(workerUrl)

  return new Promise<number[][]>((resolve, reject) => {
    let settled = false
    let onAbort: (() => void) | null = null
    const settle = (
      fn: typeof resolve | typeof reject,
      value: number[][] | Error | DOMException
    ) => {
      if (settled) return
      settled = true
      if (onAbort) signal?.removeEventListener("abort", onAbort)
      worker.terminate()
      fn(value as never)
    }
    if (signal?.aborted) {
      settle(reject, new DOMException("Aborted", "AbortError"))
      return
    }

    onAbort = () => {
      settle(reject, new DOMException("Aborted", "AbortError"))
    }
    signal?.addEventListener("abort", onAbort, { once: true })

    worker.onmessage = (e) => {
      if (e.data.type === "detectionProgress") {
        onProgress?.({
          phase: "detecting_duplicates",
          current: e.data.current,
          total: e.data.total
        })
      } else if (e.data.type === "partialDetectionResults") {
        if (settled) return
        onPartialGroups?.(e.data.groups as number[][])
      } else if (e.data.type === "detectionResults") {
        settle(resolve, e.data.groups as number[][])
      }
    }
    worker.onerror = (e) => {
      settle(
        reject,
        new Error(e.message ?? "Worker error during smart detection")
      )
    }

    worker.postMessage(
      {
        type: "detectSmart",
        data: { flatEmbeddings: flat, n, dim, threshold, buckets, timestamps, windowMs }
      },
      [flat.buffer]
    )
  })
}

export async function smartDetectDuplicates(
  mediaItems: GpdMediaItem[],
  threshold: number,
  windowMs = 1000,
  onProgress?: ProgressCallback,
  signal?: AbortSignal,
  logger?: ScanLogger,
  onPartialGroups?: DuplicateGroupsCallback
): Promise<DuplicateGroup[]> {
  const scanStart = performance.now()
  // Include items with thumbnails. Video posters work too — two copies of the
  // same clip have identical poster frames, which produce near-identical
  // embeddings.
  const candidates = mediaItems.filter((item) => item.thumb)

  // Step 1: Bucket by timestamp — no I/O, instant
  const buckets = groupByTimestamp(candidates, windowMs)
  console.log(
    `[GPD] smartDetectDuplicates: ${mediaItems.length} items → ${candidates.length} candidates → ${buckets.length} timestamp buckets`
  )
  if (buckets.length === 0) return []

  // Flatten to deduplicated subset
  const seen = new Set<string>()
  const subset: GpdMediaItem[] = []
  for (const bucket of buckets)
    for (const item of bucket)
      if (!seen.has(item.mediaKey)) {
        seen.add(item.mediaKey)
        subset.push(item)
      }

  const keys = subset.map((item) => item.mediaKey)

  // Open the managed embedding cache used by the cache UI.
  let cache: EmbeddingCache | null = null
  try {
    cache = await EmbeddingCache.open()
  } catch {
    /* cache unavailable */
  }

  const cachedKeySet: Set<string> = cache
    ? await cache.compatibleKeys(MODEL_PATH).catch(() => new Set<string>())
    : new Set()
  const cacheHits = keys.filter((k) => cachedKeySet.has(k)).length
  console.log(
    `[GPD] embedding cache: ${cacheHits}/${subset.length} hits, skipping thumbnails`
  )

  logger?.updateInfo({ candidates: subset.length, cacheHits })

  // Wrap onProgress to feed stability tracking alongside the UI callback.
  const stabilityTracker = new StabilityTracker((est) =>
    logger?.recordStableEstimate(est)
  )
  const trackedProgress: ProgressCallback = (progress) => {
    onProgress?.(progress)
    stabilityTracker.update(progress.phase, progress.current, progress.total)
  }

  const t1 = performance.now()
  const blobs = await fetchThumbnails(
    subset,
    cachedKeySet,
    trackedProgress,
    signal
  )
  const fetchThumbnailsMs = Math.round(performance.now() - t1)
  console.log(
    `[GPD] fetchThumbnails: ${subset.length - cacheHits} items in ${fetchThumbnailsMs}ms`
  )
  await logger?.phaseComplete("fetchThumbnailsMs", fetchThumbnailsMs)

  signal?.throwIfAborted()

  const t2 = performance.now()
  const { embeddings, validIndices } = await computeEmbeddings(
    blobs,
    subset,
    cache,
    cachedKeySet,
    trackedProgress,
    signal
  ).finally(() => {
    cache?.close()
    cache = null
  })
  const computeEmbeddingsMs = Math.round(performance.now() - t2)
  console.log(
    `[GPD] computeEmbeddings: ${embeddings.length} items (${cacheHits} cached) in ${computeEmbeddingsMs}ms`
  )
  await logger?.phaseComplete("computeEmbeddingsMs", computeEmbeddingsMs)

  if (embeddings.length < 2) {
    if (subset.length >= 2) {
      throw new Error(
        `Only ${embeddings.length} of ${subset.length} candidate items could be processed. Check your Google Photos connection and retry.`
      )
    }
    return []
  }

  // Build bucket index arrays (indices into embeddings[])
  const mediaKeyToEmbIdx = new Map<string, number>()
  for (let i = 0; i < validIndices.length; i++)
    mediaKeyToEmbIdx.set(subset[validIndices[i]].mediaKey, i)

  const workerBuckets = buckets
    .map((bucket) =>
      bucket
        .map((item) => mediaKeyToEmbIdx.get(item.mediaKey))
        .filter((i): i is number => i !== undefined)
    )
    .filter((b) => b.length >= 2)
  const workerTimestamps = validIndices.map((idx) => subset[idx].timestamp)

  if (workerBuckets.length === 0) return []

  // Offload pairwise comparison to worker
  trackedProgress({ phase: "detecting_duplicates", current: 0, total: 0 })
  await new Promise<void>((r) => setTimeout(r, 0)) // flush React phase update
  const workerUrl = chrome.runtime.getURL("scripts/embedder-worker.js")
  const t3 = performance.now()
  const buildGroups = (indexGroups: number[][]): DuplicateGroup[] =>
    indexGroups
      .map((indices, i) => {
        const items = indices
          .map((idx) => subset[validIndices[idx]])
          .sort((a, b) => (a.creationTimestamp ?? 0) - (b.creationTimestamp ?? 0))
        return {
          id: `group-${i}`,
          mediaKeys: items.map((x) => x.mediaKey),
          originalMediaKey: selectDefaultKeep(items),
          similarity: threshold,
          ...classifyDuplicateItems(items)
        }
      })
      .sort((a, b) => b.mediaKeys.length - a.mediaKeys.length)

  const indexGroups = await runSmartDetectionInWorker(
    embeddings,
    threshold,
    workerBuckets,
    workerTimestamps,
    windowMs,
    workerUrl,
    trackedProgress,
    signal,
    onPartialGroups ? (groups) => onPartialGroups(buildGroups(groups)) : undefined
  )
  const communityDetectionMs = Math.round(performance.now() - t3)
  const totalMs = Math.round(performance.now() - scanStart)
  console.log(
    `[GPD] communityDetection: ${indexGroups.length} groups in ${communityDetectionMs}ms`
  )
  console.log(`[GPD] scan complete: ${totalMs}ms total`)
  await logger?.phaseComplete("communityDetectionMs", communityDetectionMs)

  return buildGroups(indexGroups)
}

// ============================================================
// Step 1: Fetch thumbnails
// ============================================================

async function fetchThumbnails(
  items: GpdMediaItem[],
  cachedKeySet: Set<string>,
  onProgress?: ProgressCallback,
  signal?: AbortSignal
): Promise<(Blob | null)[]> {
  const concurrency = 10
  const fetchTimeoutMs = 8000
  const blobs: (Blob | null)[] = new Array(items.length).fill(null)
  let completed = 0

  // Only enqueue items that don't have a cached embedding
  const queue = items
    .map((item, i) => ({ item, index: i }))
    .filter(({ item }) => !cachedKeySet.has(item.mediaKey))

  // Report progress only against items that actually need downloading.
  // Counting cached items as "pre-completed" caused the bar to start at e.g. 80%
  // and never visibly move before the phase transitioned.
  const total = queue.length

  const reportProgress = () => {
    if (total === 0) return
    if (completed % 50 === 0 || completed === total) {
      onProgress?.({
        phase: "downloading_thumbnails",
        current: completed,
        total
      })
    }
  }

  const worker = async () => {
    while (queue.length > 0) {
      signal?.throwIfAborted()
      const entry = queue.shift()
      if (!entry) break

      try {
        const url = entry.item.thumb + `=h${THUMB_HEIGHT}`
        const response = await fetch(url, {
          credentials: "include",
          signal: (
            AbortSignal as typeof AbortSignal & {
              any(signals: AbortSignal[]): AbortSignal
            }
          ).any([
            AbortSignal.timeout(fetchTimeoutMs),
            ...(signal ? [signal] : [])
          ])
        })
        if (response.ok) {
          blobs[entry.index] = await response.blob()
        } else {
          response.body?.cancel()
        }
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") throw e
        // Skip other failed downloads (timeouts, network errors, rate limits)
      }

      completed++
      reportProgress()
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker())
  await Promise.all(workers)

  return blobs
}

// ============================================================
// Step 2: Compute embeddings via MediaPipe worker pool
// ============================================================

const WORKER_BATCH_SIZE = 20

function dominantEmbeddingDimension(embeddings: Float32Array[]): number | null {
  const counts = new Map<number, number>()
  for (const embedding of embeddings) {
    if (embedding.length <= 0) continue
    counts.set(embedding.length, (counts.get(embedding.length) ?? 0) + 1)
  }
  let bestDim: number | null = null
  let bestCount = 0
  for (const [dim, count] of counts) {
    if (count > bestCount || (count === bestCount && dim > (bestDim ?? 0))) {
      bestDim = dim
      bestCount = count
    }
  }
  return bestDim
}

export async function computeEmbeddings(
  blobs: (Blob | null)[],
  items: GpdMediaItem[],
  cache: EmbeddingCache | null,
  cachedKeySet: Set<string>,
  onProgress?: ProgressCallback,
  signal?: AbortSignal
): Promise<{ embeddings: Float32Array[]; validIndices: number[] }> {
  const keys = items.map((item) => item.mediaKey)
  const scannedAt = Date.now()
  // Stage B: bulk-load embedding values for cached items.
  const cachedEmbeddings = new Map<number, Float32Array>()
  if (cache && cachedKeySet.size > 0) {
    const cachedValues = await cache
      .getCompatibleMany(keys, MODEL_PATH)
      .catch(() => [])
    cachedValues.forEach((embedding, index) => {
      if (embedding) cachedEmbeddings.set(index, embedding)
    })
  }

  // Collect items that actually need computation
  const toCompute: Array<{ idx: number; blob: Blob }> = []
  for (let i = 0; i < blobs.length; i++) {
    if (!cachedEmbeddings.has(i) && blobs[i]) {
      toCompute.push({ idx: i, blob: blobs[i]! })
    }
  }

  // Run worker pool for items needing computation
  const newEmbeddings = new Map<number, Float32Array>()
  const cacheWrites: Promise<void>[] = []
  if (toCompute.length > 0) {
    signal?.throwIfAborted()

    // Fetch model once on main thread; workers receive clones
    let modelBuffer: ArrayBuffer
    try {
      const resp = await fetch(chrome.runtime.getURL(MODEL_PATH))
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      modelBuffer = await resp.arrayBuffer()
    } catch (e) {
      throw new Error(
        `Failed to load bundled model: ${e instanceof Error ? e.message : e}`
      )
    }

    const wasmLoaderUrl = chrome.runtime.getURL(
      "scripts/vision_wasm_internal.js"
    )
    const wasmBinaryUrl = chrome.runtime.getURL(
      "scripts/vision_wasm_internal.wasm"
    )
    const workerUrl = chrome.runtime.getURL("scripts/embedder-worker.js")
    const numWorkers = Math.max(
      1,
      Math.min(navigator.hardwareConcurrency ?? 4, 8)
    )

    console.log(
      `[GPD] embedding: ${toCompute.length} items, ${numWorkers} workers`
    )

    // Create and init all workers in parallel
    const workers = Array.from(
      { length: numWorkers },
      () => new Worker(workerUrl)
    )

    await Promise.all(
      workers.map(
        (w, i) =>
          new Promise<void>((resolve, reject) => {
            w.onmessage = (e) => {
              if (e.data.type === "ready") resolve()
              else if (e.data.type === "initError")
                reject(new Error(e.data.message))
            }
            w.onerror = (e) => reject(new Error(e.message))
            w.postMessage(
              {
                type: "init",
                data: {
                  wasmLoaderUrl,
                  wasmBinaryUrl,
                  modelBuffer: modelBuffer.slice(0)
                }
              },
              [modelBuffer.slice(0)] // transfer a clone; main thread keeps original for next worker
            )
          })
      )
    ).catch((e) => {
      workers.forEach((w) => w.terminate())
      throw new Error(`Worker init failed: ${e.message}`)
    })

    // Work queue: pull-based dispatch so fast workers take more items
    let queuePos = 0
    let completedItems = 0
    let pendingWorkers = numWorkers

    await new Promise<void>((resolve, reject) => {
      signal?.addEventListener(
        "abort",
        () => {
          workers.forEach((w) => w.terminate())
          reject(new DOMException("Aborted", "AbortError"))
        },
        { once: true }
      )

      const dispatch = (w: Worker) => {
        const start = queuePos
        if (start >= toCompute.length) {
          if (--pendingWorkers === 0) resolve()
          return
        }
        queuePos = Math.min(start + WORKER_BATCH_SIZE, toCompute.length)
        const batch = toCompute.slice(start, queuePos).map((item, j) => ({
          localIdx: start + j,
          blob: item.blob
        }))
        w.postMessage({ type: "embed", data: { items: batch } })
      }

      workers.forEach((w) => {
        w.onmessage = (e) => {
          if (e.data.type !== "results") return
          const records: Parameters<EmbeddingCache["setMany"]>[0] = []
          for (const { localIdx, embedding } of e.data.results as Array<{
            localIdx: number
            embedding: ArrayBuffer
          }>) {
            const idx = toCompute[localIdx].idx
            const emb = new Float32Array(embedding)
            newEmbeddings.set(idx, emb)
            records.push({
              mediaKey: keys[idx],
              embedding: emb,
              metadata: createCachedMediaMetadata(items[idx]),
              scannedAt,
              model: MODEL_PATH
            })
            // Write to cache as batches complete, rather than waiting for the
            // full scan. If the scan is cancelled or the tab closes mid-run,
            // embeddings computed so far are preserved best-effort.
          }
          if (cache && records.length > 0) {
            cacheWrites.push(cache.setMany(records).catch(() => undefined))
          }
          completedItems += e.data.results.length
          onProgress?.({
            phase: "computing_embeddings",
            current: cachedEmbeddings.size + completedItems,
            total: blobs.length
          })
          dispatch(w)
        }
        w.onerror = (e) => {
          workers.forEach((worker) => worker.terminate())
          reject(new Error(e.message || "Embedding worker failed"))
        }
        dispatch(w)
      })
    })

    workers.forEach((w) => w.terminate())
  }

  await Promise.all(cacheWrites)

  // Final progress update if everything was cached (no workers ran)
  if (toCompute.length === 0) {
    onProgress?.({
      phase: "computing_embeddings",
      current: blobs.length,
      total: blobs.length
    })
  }

  // Assemble result in original order
  const embeddings: Float32Array[] = []
  const validIndices: number[] = []
  const assembled: Array<{ embedding: Float32Array; index: number }> = []
  for (let i = 0; i < blobs.length; i++) {
    const emb = cachedEmbeddings.get(i) ?? newEmbeddings.get(i)
    if (emb) {
      assembled.push({ embedding: emb, index: i })
    }
  }

  const expectedDim =
    dominantEmbeddingDimension([...newEmbeddings.values()]) ??
    dominantEmbeddingDimension(assembled.map((entry) => entry.embedding))
  for (const { embedding, index } of assembled) {
    if (expectedDim !== null && embedding.length === expectedDim) {
      embeddings.push(embedding)
      validIndices.push(index)
    }
  }

  return { embeddings, validIndices }
}

// ============================================================
// Step 3: Community detection — worker wrapper
// ============================================================

/**
 * Runs communityDetection in a dedicated worker so the main thread stays
 * responsive during the computation.
 *
 * Embeddings are packed into a single transferable Float32Array and sent
 * to the worker. The worker returns number[][] (the group index lists).
 */
async function runCommunityDetectionInWorker(
  embeddings: Float32Array[],
  threshold: number,
  workerUrl: string,
  onProgress?: ProgressCallback,
  signal?: AbortSignal,
  onPartialGroups?: (groups: number[][]) => void
): Promise<number[][]> {
  const n = embeddings.length
  if (n < 2) return []
  const dim = embeddings[0].length
  const blockSize = FULL_SCAN_BLOCK_SIZE
  const blockCount = Math.ceil(n / blockSize)
  const totalBlockPairs = blockPairCountForItems(n, blockSize)
  const parent = Array.from({ length: n }, (_, i) => i)
  const find = (x: number): number =>
    parent[x] === x ? x : (parent[x] = find(parent[x]))
  const union = (a: number, b: number) => {
    const rootA = find(a)
    const rootB = find(b)
    if (rootA !== rootB) parent[rootA] = rootB
  }
  const worker = new Worker(workerUrl)

  const buildComponents = (): number[][] => {
    const components = new Map<number, number[]>()
    for (let i = 0; i < n; i++) {
      const root = find(i)
      if (!components.has(root)) components.set(root, [])
      components.get(root)!.push(i)
    }
    return [...components.values()]
      .filter((group) => group.length >= 2)
      .sort((a, b) => b.length - a.length)
  }

  const makeFlatBlock = (start: number, end: number): Float32Array => {
    const flat = new Float32Array((end - start) * dim)
    for (let i = start; i < end; i++) flat.set(embeddings[i], (i - start) * dim)
    return flat
  }

  const compareBlock = (
    blockA: number,
    blockB: number
  ): Promise<Array<[number, number]>> => {
    const startA = blockA * blockSize
    const endA = Math.min(startA + blockSize, n)
    const startB = blockB * blockSize
    const endB = Math.min(startB + blockSize, n)
    const flatA = makeFlatBlock(startA, endA)
    const flatB =
      blockA === blockB ? flatA.slice(0) : makeFlatBlock(startB, endB)

    return new Promise((resolve, reject) => {
      let settled = false
      const resolveOnce = (pairs: Array<[number, number]>) => {
        if (settled) return
        settled = true
        resolve(pairs)
      }
      const rejectOnce = (error: Error) => {
        if (settled) return
        settled = true
        reject(error)
      }
      worker.onmessage = (e) => {
        if (e.data.type === "blockResults") {
          resolveOnce(e.data.pairs as Array<[number, number]>)
          return
        }
        rejectOnce(
          new Error(`Unexpected worker response during block comparison: ${e.data.type}`)
        )
      }
      worker.onerror = (e) =>
        rejectOnce(
          new Error(e.message ?? "Worker error during block comparison")
        )
      worker.postMessage(
        {
          type: "detectBlock",
          data: {
            flatA,
            rowsA: endA - startA,
            offsetA: startA,
            flatB,
            rowsB: endB - startB,
            offsetB: startB,
            dim,
            threshold,
            sameBlock: blockA === blockB
          }
        },
        [flatA.buffer, flatB.buffer]
      )
    })
  }

  return new Promise<number[][]>((resolve, reject) => {
    if (signal?.aborted) {
      worker.terminate()
      reject(new DOMException("Aborted", "AbortError"))
      return
    }

    const onAbort = () => {
      worker.terminate()
      reject(new DOMException("Aborted", "AbortError"))
    }
    signal?.addEventListener("abort", onAbort, { once: true })

    ;(async () => {
      try {
        let completed = 0
        for (let blockA = 0; blockA < blockCount; blockA++) {
          for (let blockB = blockA; blockB < blockCount; blockB++) {
            if (signal?.aborted) throw new DOMException("Aborted", "AbortError")
            const pairs = await compareBlock(blockA, blockB)
            for (const [a, b] of pairs) union(a, b)
            if (pairs.length > 0) onPartialGroups?.(buildComponents())
            completed++
            onProgress?.({
              phase: "detecting_duplicates",
              current: completed,
              total: totalBlockPairs
            })
            await new Promise<void>((r) => setTimeout(r, 0))
          }
        }

        const groups = buildComponents()
        signal?.removeEventListener("abort", onAbort)
        worker.terminate()
        resolve(groups)
      } catch (error) {
        signal?.removeEventListener("abort", onAbort)
        worker.terminate()
        reject(error)
      }
    })()

  })
}

// ============================================================
// Community detection
// Sorts by timestamp, then walks through comparing each photo
// to the next. Consecutive similar photos are grouped together.
// O(n) instead of O(n²).
// ============================================================

/**
 * Find groups of similar embeddings by sorting on timestamp and
 * comparing each photo to the next one in the sorted list.
 * Returns groups of original indices.
 *
 * Exported for unit testing.
 */
export function communityDetection(
  embeddings: Float32Array[],
  threshold: number,
  timestamps?: number[]
): number[][] {
  const n = embeddings.length
  if (n < 2) return []
  const dim = embeddings[0].length

  // Sort by timestamp so nearby photos are adjacent
  const order = Array.from({ length: n }, (_, i) => i)
  if (timestamps) {
    order.sort((a, b) => (timestamps[a] ?? 0) - (timestamps[b] ?? 0))
  }

  const sorted: Float32Array[] = order.map((i) => embeddings[i])
  const groups: number[][] = []
  let currentGroup: number[] = [order[0]]

  for (let i = 0; i < n - 1; i++) {
    // Cosine similarity = dot product (embeddings are L2-normalized)
    const a = sorted[i]
    const b = sorted[i + 1]
    let dot = 0
    for (let k = 0; k < dim; k++) dot += a[k] * b[k]

    if (dot >= threshold) {
      currentGroup.push(order[i + 1])
    } else {
      if (currentGroup.length >= 2) groups.push(currentGroup)
      currentGroup = [order[i + 1]]
    }
  }

  if (currentGroup.length >= 2) groups.push(currentGroup)

  groups.sort((a, b) => b.length - a.length)
  return groups
}

// ============================================================
// Linear algebra helpers (typed arrays, no external deps)
// ============================================================

/**
 * Matrix multiplication: A[startA:endA] x B[startB:endB]^T
 * A and B are arrays of Float32Array (rows).
 * Returns a flat Float32Array of shape [endA-startA, endB-startB].
 *
 * Exported for unit testing.
 */
export function matMul(
  A: Float32Array[],
  startA: number,
  endA: number,
  B: Float32Array[],
  startB: number,
  endB: number,
  dim: number
): Float32Array {
  const rowsA = endA - startA
  const rowsB = endB - startB
  const result = new Float32Array(rowsA * rowsB)

  for (let i = 0; i < rowsA; i++) {
    const aRow = A[startA + i]
    for (let j = 0; j < rowsB; j++) {
      const bRow = B[startB + j]
      let dot = 0
      for (let k = 0; k < dim; k++) {
        dot += aRow[k] * bRow[k]
      }
      result[i * rowsB + j] = dot
    }
  }

  return result
}

/**
 * Find top-k largest values and their indices in a Float32Array.
 * Uses min-heap for small k (O(n log k)) and quickselect for large k (O(n) average).
 *
 * Exported for unit testing.
 */
export function topK(
  arr: Float32Array,
  k: number
): { values: number[]; indices: number[] } {
  const n = arr.length
  k = Math.min(k, n)
  if (k <= 0) return { values: [], indices: [] }

  // For small k, use min-heap — O(n log k) with low constant factor, no object allocation
  if (k <= 50) {
    const hVals = new Float32Array(k)
    const hIdxs = new Uint32Array(k)
    let size = 0

    const siftDown = (pos: number) => {
      while (true) {
        let smallest = pos
        const l = 2 * pos + 1
        const r = l + 1
        if (l < size && hVals[l] < hVals[smallest]) smallest = l
        if (r < size && hVals[r] < hVals[smallest]) smallest = r
        if (smallest === pos) break
        let tmp = hVals[pos]
        hVals[pos] = hVals[smallest]
        hVals[smallest] = tmp
        let ti = hIdxs[pos]
        hIdxs[pos] = hIdxs[smallest]
        hIdxs[smallest] = ti
        pos = smallest
      }
    }

    for (let i = 0; i < n; i++) {
      const v = arr[i]
      if (size < k) {
        hVals[size] = v
        hIdxs[size] = i
        size++
        for (let p = (size >> 1) - 1; p >= 0; p--) siftDown(p)
      } else if (v > hVals[0]) {
        hVals[0] = v
        hIdxs[0] = i
        siftDown(0)
      }
    }

    // Pop from heap into descending order
    const values: number[] = new Array(size)
    const indices: number[] = new Array(size)
    for (let i = size - 1; i >= 0; i--) {
      values[i] = hVals[0]
      indices[i] = hIdxs[0]
      hVals[0] = hVals[--size]
      hIdxs[0] = hIdxs[size]
      siftDown(0)
    }
    return { values, indices }
  }

  // For larger k, use quickselect — O(n) average
  const vals = new Float32Array(n)
  const idxs = new Uint32Array(n)
  for (let i = 0; i < n; i++) {
    vals[i] = arr[i]
    idxs[i] = i
  }

  let lo = 0,
    hi = n - 1
  while (lo < hi) {
    const pivot = vals[hi]
    let p = lo
    for (let i = lo; i < hi; i++) {
      if (vals[i] >= pivot) {
        let tv = vals[p]
        vals[p] = vals[i]
        vals[i] = tv
        let ti = idxs[p]
        idxs[p] = idxs[i]
        idxs[i] = ti
        p++
      }
    }
    let tv = vals[p]
    vals[p] = vals[hi]
    vals[hi] = tv
    let ti = idxs[p]
    idxs[p] = idxs[hi]
    idxs[hi] = ti
    if (p === k - 1) break
    if (p < k - 1) lo = p + 1
    else hi = p - 1
  }

  // Insertion sort the top-k partition for descending order
  for (let i = 1; i < k; i++) {
    const v = vals[i]
    const ix = idxs[i]
    let j = i - 1
    while (j >= 0 && vals[j] < v) {
      vals[j + 1] = vals[j]
      idxs[j + 1] = idxs[j]
      j--
    }
    vals[j + 1] = v
    idxs[j + 1] = ix
  }

  const values: number[] = new Array(k)
  const indices: number[] = new Array(k)
  for (let i = 0; i < k; i++) {
    values[i] = vals[i]
    indices[i] = idxs[i]
  }
  return { values, indices }
}
