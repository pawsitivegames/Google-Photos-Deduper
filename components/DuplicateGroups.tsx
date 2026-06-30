import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded"
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded"
import OpenInFullIcon from "@mui/icons-material/OpenInFull"
import Box from "@mui/material/Box"
import Button from "@mui/material/Button"
import Card from "@mui/material/Card"
import CardActionArea from "@mui/material/CardActionArea"
import CardContent from "@mui/material/CardContent"
import CardMedia from "@mui/material/CardMedia"
import Checkbox from "@mui/material/Checkbox"
import Chip from "@mui/material/Chip"
import IconButton from "@mui/material/IconButton"
import Paper from "@mui/material/Paper"
import Skeleton from "@mui/material/Skeleton"
import Stack from "@mui/material/Stack"
import Typography from "@mui/material/Typography"
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties
} from "react"
import { VariableSizeList } from "react-window"
import type { ListChildComponentProps } from "react-window"

import { classifyDuplicateGroup } from "../lib/duplicate-classifier"
import type { DuplicateGroup, GpdMediaItem } from "../lib/types"
import { PhotoViewerModal } from "./PhotoViewerModal"
import { useBlobUrl } from "./useBlobUrl"

const REVIEW_LIST_MAX_HEIGHT = 900
const REVIEW_LIST_VIEWPORT_OFFSET = 300
const REVIEW_LIST_FALLBACK_WIDTH = 900
const REVIEW_CARD_WIDTH = 190
const REVIEW_CARD_GAP = 12
const REVIEW_ROW_HEADER_HEIGHT = 62
const REVIEW_ROW_VERTICAL_PADDING = 24
const REVIEW_CARD_ESTIMATED_HEIGHT = 286
const REVIEW_ROW_MARGIN_BOTTOM = 16

/**
 * Label a group as "videos", "photos", or "items" depending on the kinds of
 * media inside. Groups with both kinds (rare, only possible if a video's
 * poster happens to match a still) fall back to the neutral "items".
 */
function groupItemKind(
  group: DuplicateGroup,
  mediaItems: Record<string, GpdMediaItem>
): string {
  let videos = 0
  let total = 0
  for (const key of group.mediaKeys) {
    const item = mediaItems[key]
    if (!item) continue
    total++
    if (item.duration) videos++
  }
  if (total === 0) return "items"
  if (videos === total) return total === 1 ? "video" : "videos"
  if (videos === 0) return total === 1 ? "photo" : "photos"
  return "items"
}

function storageStatusLabel(item: GpdMediaItem): string {
  if (item.takesUpSpace === false) return "No storage"
  if (item.takesUpSpace === true) return "Counts storage"
  return "Storage unknown"
}

// ── Hoisted static sx objects ──────────────────────────────────────────
const sxPaperBase = {
  mb: 2,
  overflow: "hidden",
  borderRadius: 3,
  border: "1px solid",
  borderColor: "divider",
  boxShadow: "0 14px 38px rgba(0, 0, 0, 0.06)",
  transition: "opacity 0.15s, border-color 0.15s, box-shadow 0.15s"
}
const sxGroupHeader = {
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: 1,
  px: 2,
  py: 1.25,
  backgroundColor: "rgba(255,255,255,0.82)",
  borderBottom: "1px solid",
  borderColor: "divider",
  cursor: "pointer",
  userSelect: "none"
}
const sxCheckbox = { p: 0.5, mr: 0.5 }
const sxChipSimilarity = { fontSize: 11 }
const sxThumbnailsWrapper = {
  display: "flex",
  flexWrap: "wrap",
  gap: 1.5,
  p: 1.5,
  backgroundColor: "rgba(255,255,255,0.44)"
}
const sxItemWrapper = {
  position: "relative",
  width: REVIEW_CARD_WIDTH,
  flexShrink: 0,
  "& .viewer-btn": { opacity: 0 },
  "&:hover .viewer-btn": { opacity: 1 }
}
const sxCardBase = {
  width: "100%",
  overflow: "hidden",
  transition: "border-color 0.15s, box-shadow 0.15s, transform 0.15s",
  "&:hover": {
    transform: "translateY(-1px)",
    boxShadow: "0 14px 30px rgba(0, 0, 0, 0.12)"
  }
}
const sxCardContent = {
  p: 1,
  "&:last-child": { pb: 1 },
  display: "flex",
  flexDirection: "column",
  gap: 0.5
}
const sxViewerBtn = {
  position: "absolute",
  top: 4,
  right: 4,
  bgcolor: "rgba(29,29,31,0.62)",
  color: "white",
  transition: "opacity 0.15s",
  minWidth: 32,
  minHeight: 32,
  backdropFilter: "blur(10px)",
  "&:hover": { bgcolor: "rgba(29,29,31,0.78)" }
}
const sxOpenInFullIcon = { fontSize: 14 }
const sxStatusChip = { width: "fit-content", height: 20, fontSize: 11 }
const sxVirtualList: CSSProperties = {
  overflowX: "hidden"
}
// ──────────────────────────────────────────────────────────────────────

function estimateGroupRowHeight(group: DuplicateGroup, width: number): number {
  const usableWidth = Math.max(width, REVIEW_CARD_WIDTH)
  const columns = Math.max(
    1,
    Math.floor(
      (usableWidth + REVIEW_CARD_GAP) / (REVIEW_CARD_WIDTH + REVIEW_CARD_GAP)
    )
  )
  const thumbnailRows = Math.max(1, Math.ceil(group.mediaKeys.length / columns))
  return (
    REVIEW_ROW_HEADER_HEIGHT +
    REVIEW_ROW_VERTICAL_PADDING +
    thumbnailRows * REVIEW_CARD_ESTIMATED_HEIGHT +
    Math.max(0, thumbnailRows - 1) * REVIEW_CARD_GAP +
    REVIEW_ROW_MARGIN_BOTTOM
  )
}

function useMeasuredWidth<T extends HTMLElement>(
  fallbackWidth = REVIEW_LIST_FALLBACK_WIDTH
) {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(fallbackWidth)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return

    const measure = () => {
      const nextWidth = el.getBoundingClientRect().width
      if (nextWidth > 0) setWidth(Math.round(nextWidth))
    }

    measure()

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure)
      return () => window.removeEventListener("resize", measure)
    }

    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return { ref, width }
}

const FALLBACK_THUMBNAIL_BACKDROPS = [
  "linear-gradient(135deg, #A7C7E7 0%, #F8D6C4 48%, #7E9F90 100%)",
  "linear-gradient(135deg, #D8E2DC 0%, #FFE5D9 52%, #9D8189 100%)",
  "linear-gradient(135deg, #B8C0FF 0%, #FFD6A5 50%, #CAFFBF 100%)",
  "linear-gradient(135deg, #CDE7F0 0%, #F6D6AD 45%, #8FA998 100%)",
  "linear-gradient(135deg, #E3D5CA 0%, #B7B7A4 55%, #6B705C 100%)"
]

function fallbackThumbnailBackground(seed: string): string {
  const index = Math.abs(
    seed.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0)
  )
  return FALLBACK_THUMBNAIL_BACKDROPS[
    index % FALLBACK_THUMBNAIL_BACKDROPS.length
  ]
}

function ThumbnailImage({ src, alt }: { src: string; alt: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: "300px" }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const hasUsableSource = src.startsWith("http")
  const { blobUrl } = useBlobUrl(hasUsableSource && visible ? src : undefined)

  if (!hasUsableSource) {
    return (
      <Box
        ref={ref}
        sx={{
          height: 132,
          background: fallbackThumbnailBackground(alt),
          position: "relative",
          overflow: "hidden",
          "&:after": {
            content: '""',
            position: "absolute",
            inset: "50% -10% -20%",
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.66), rgba(255,255,255,0.08))",
            transform: "skewY(-9deg)"
          }
        }}
      />
    )
  }

  return (
    <div ref={ref}>
      {blobUrl ? (
        <CardMedia
          component="img"
          image={blobUrl}
          alt={alt}
          sx={{ height: 132, objectFit: "cover" }}
        />
      ) : (
        <Skeleton variant="rectangular" height={132} animation="wave" />
      )}
    </div>
  )
}

interface DuplicateGroupRowProps {
  group: DuplicateGroup
  mediaItems: Record<string, GpdMediaItem>
  isSelected: boolean
  keptSet: Set<string>
  onToggleGroup: (groupId: string) => void
  onToggleKept: (group: DuplicateGroup, mediaKey: string) => void
  onTrashAll: (group: DuplicateGroup) => void
  onOpenViewer: (group: DuplicateGroup, index: number) => void
  readOnly?: boolean
}

const DuplicateGroupRow = memo(function DuplicateGroupRow({
  group,
  mediaItems,
  isSelected,
  keptSet,
  onToggleGroup,
  onToggleKept,
  onTrashAll,
  onOpenViewer,
  readOnly = false
}: DuplicateGroupRowProps) {
  const classification =
    group.duplicateKind && group.matchReasons
      ? {
          duplicateKind: group.duplicateKind,
          matchReasons: group.matchReasons
        }
      : classifyDuplicateGroup(group, mediaItems)
  const classificationLabel =
    classification.duplicateKind === "exact" ? "Exact duplicate" : "Similar"
  const classificationColor =
    classification.duplicateKind === "exact" ? "success" : "warning"
  const classificationTitle =
    classification.matchReasons.length > 0
      ? classification.matchReasons.join(", ")
      : "visual similarity"

  return (
    <Paper
      variant="outlined"
      sx={[
        sxPaperBase,
        {
          opacity: readOnly || isSelected ? 1 : 0.72,
          borderColor: isSelected ? "primary.main" : "divider"
        }
      ]}>
      {/* Group header */}
      <Box
        onClick={() => {
          if (!readOnly) onToggleGroup(group.id)
        }}
        sx={sxGroupHeader}>
        {!readOnly && (
          <Checkbox
            size="small"
            checked={isSelected}
            onChange={() => onToggleGroup(group.id)}
            onClick={(e) => e.stopPropagation()}
            sx={sxCheckbox}
          />
        )}
        <Box sx={{ flex: 1, minWidth: 180 }}>
          <Typography variant="subtitle2" fontWeight={700}>
            {group.mediaKeys.length} {groupItemKind(group, mediaItems)}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Click a copy to keep it. Everything marked trash will move later.
          </Typography>
        </Box>
        <Stack
          direction="row"
          spacing={0.75}
          flexWrap="wrap"
          useFlexGap
          sx={{ width: { xs: "100%", sm: "auto" } }}>
          <Chip
            label={`${Math.round(group.similarity * 100)}% match`}
            size="small"
            variant="outlined"
            sx={sxChipSimilarity}
          />
          <Chip
            label={classificationLabel}
            size="small"
            color={classificationColor}
            variant="outlined"
            title={classificationTitle}
            sx={sxChipSimilarity}
          />
          {!readOnly && (
            <Button
              size="small"
              color="error"
              variant={keptSet.size === 0 ? "contained" : "outlined"}
              startIcon={<DeleteOutlineRoundedIcon />}
              onClick={(event) => {
                event.stopPropagation()
                onTrashAll(group)
              }}>
              Trash all copies
            </Button>
          )}
        </Stack>
      </Box>

      {/* Thumbnails */}
      <Box sx={sxThumbnailsWrapper}>
        {group.mediaKeys.map((key, itemIndex) => {
          const item = mediaItems[key]
          if (!item) return null
          const isKept = keptSet.has(key)

          return (
            <Box key={key} sx={sxItemWrapper}>
              <Card
                variant="outlined"
                sx={[
                  sxCardBase,
                  {
                    bgcolor: isKept
                      ? "rgba(234, 244, 255, 0.68)"
                      : isSelected
                        ? "rgba(255, 236, 236, 0.58)"
                        : "background.paper",
                    borderColor: isKept
                      ? "primary.main"
                      : isSelected
                        ? "error.main"
                        : "divider",
                    borderWidth: isKept || isSelected ? 2 : 1
                  }
                ]}>
                <CardActionArea
                  onClick={() => {
                    if (!readOnly) onToggleKept(group, key)
                    else onOpenViewer(group, itemIndex)
                  }}>
                  <ThumbnailImage
                    src={
                      item.thumb.startsWith("data:")
                        ? item.thumb
                        : item.provider && item.provider !== "google"
                          ? item.thumb
                          : item.thumb + "=h200"
                    }
                    alt={item.fileName || item.mediaKey}
                  />
                  <CardContent sx={sxCardContent}>
                    {item.fileName && (
                      <Typography
                        variant="caption"
                        display="block"
                        noWrap
                        title={item.fileName}>
                        {item.fileName}
                      </Typography>
                    )}
                    {item.resWidth && item.resHeight && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ fontFamily: "monospace" }}>
                        {item.resWidth}×{item.resHeight}
                      </Typography>
                    )}
                    {item.timestamp ? (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        display="block">
                        <span style={{ opacity: 0.6 }}>Taken </span>
                        {new Date(item.timestamp).toLocaleDateString(
                          undefined,
                          {
                            year: "numeric",
                            month: "short",
                            day: "numeric"
                          }
                        )}
                      </Typography>
                    ) : null}
                    {item.creationTimestamp ? (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        display="block">
                        <span style={{ opacity: 0.6 }}>Uploaded </span>
                        {new Date(item.creationTimestamp).toLocaleDateString(
                          undefined,
                          {
                            year: "numeric",
                            month: "short",
                            day: "numeric"
                          }
                        )}
                      </Typography>
                    ) : null}
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      display="block">
                      {storageStatusLabel(item)}
                    </Typography>
                    {isKept ? (
                      <Chip
                        icon={<CheckCircleRoundedIcon />}
                        label="Keep this"
                        size="small"
                        color="primary"
                        variant="outlined"
                        sx={sxStatusChip}
                      />
                    ) : isSelected ? (
                      <Chip
                        icon={<DeleteOutlineRoundedIcon />}
                        label="Will trash"
                        size="small"
                        color="error"
                        variant="outlined"
                        sx={sxStatusChip}
                      />
                    ) : null}
                  </CardContent>
                </CardActionArea>
              </Card>

              {/* Zoom overlay — secondary action, does not trigger Keep toggle */}
              <IconButton
                className="viewer-btn"
                size="small"
                aria-label="View full size"
                onClick={(e) => {
                  e.stopPropagation()
                  onOpenViewer(group, itemIndex)
                }}
                sx={sxViewerBtn}>
                <OpenInFullIcon sx={sxOpenInFullIcon} />
              </IconButton>
            </Box>
          )
        })}
      </Box>
    </Paper>
  )
})

interface DuplicateGroupsProps {
  groups: DuplicateGroup[]
  mediaItems: Record<string, GpdMediaItem>
  selectedGroupIds: Set<string>
  onToggleGroup: (groupId: string) => void
  keptByGroupId: Map<string, Set<string>>
  onToggleKept: (group: DuplicateGroup, mediaKey: string) => void
  onTrashAll: (group: DuplicateGroup) => void
  readOnly?: boolean
  heading?: string
}

interface VirtualGroupListData {
  groups: DuplicateGroup[]
  mediaItems: Record<string, GpdMediaItem>
  selectedGroupIds: Set<string>
  keptByGroupId: Map<string, Set<string>>
  onToggleGroup: (groupId: string) => void
  onToggleKept: (group: DuplicateGroup, mediaKey: string) => void
  onTrashAll: (group: DuplicateGroup) => void
  onOpenViewer: (group: DuplicateGroup, index: number) => void
  readOnly: boolean
}

function VirtualGroupRow({
  index,
  style,
  data
}: ListChildComponentProps<VirtualGroupListData>) {
  const group = data.groups[index]
  if (!group) return null

  return (
    <Box style={style} sx={{ pr: 0.5 }}>
      <DuplicateGroupRow
        group={group}
        mediaItems={data.mediaItems}
        isSelected={data.selectedGroupIds.has(group.id)}
        keptSet={data.keptByGroupId.get(group.id) ?? new Set()}
        onToggleGroup={data.onToggleGroup}
        onToggleKept={data.onToggleKept}
        onTrashAll={data.onTrashAll}
        onOpenViewer={data.onOpenViewer}
        readOnly={data.readOnly}
      />
    </Box>
  )
}

export function DuplicateGroups({
  groups,
  mediaItems,
  selectedGroupIds,
  onToggleGroup,
  keptByGroupId,
  onToggleKept,
  onTrashAll,
  readOnly = false,
  heading
}: DuplicateGroupsProps) {
  // Measure time from first non-empty groups render to commit
  const renderLoggedRef = useRef(false)
  const renderStartRef = useRef<number | null>(null)
  if (
    groups.length > 0 &&
    !renderLoggedRef.current &&
    renderStartRef.current === null
  ) {
    renderStartRef.current = performance.now()
  }
  useEffect(() => {
    if (
      renderLoggedRef.current ||
      renderStartRef.current === null ||
      groups.length === 0
    )
      return
    renderLoggedRef.current = true
    const elapsed = performance.now() - renderStartRef.current
    const totalThumbnails = groups.reduce((s, g) => s + g.mediaKeys.length, 0)
    console.log(
      `[GPD perf] Results render: ${elapsed.toFixed(0)}ms for ${groups.length} groups, ${totalThumbnails} thumbnails`
    )
  })

  const [viewerState, setViewerState] = useState<{
    group: DuplicateGroup
    index: number
  } | null>(null)
  const { ref: listContainerRef, width: listWidth } =
    useMeasuredWidth<HTMLDivElement>()
  const listRef = useRef<VariableSizeList<VirtualGroupListData>>(null)

  const onOpenViewer = useCallback((group: DuplicateGroup, index: number) => {
    setViewerState({ group, index })
  }, [])

  const currentGroupIndex = useMemo(() => {
    return viewerState
      ? groups.findIndex((g) => g.id === viewerState.group.id)
      : -1
  }, [viewerState, groups])

  const handleNextGroup = useCallback(() => {
    if (currentGroupIndex !== -1 && currentGroupIndex < groups.length - 1) {
      setViewerState({ group: groups[currentGroupIndex + 1], index: 0 })
    }
  }, [currentGroupIndex, groups])

  const handlePrevGroup = useCallback(() => {
    if (currentGroupIndex > 0) {
      setViewerState({ group: groups[currentGroupIndex - 1], index: 0 })
    }
  }, [currentGroupIndex, groups])

  const viewerItems = useMemo(() => {
    if (!viewerState) return []
    return viewerState.group.mediaKeys
      .map((k) => mediaItems[k])
      .filter((item): item is GpdMediaItem => !!item)
  }, [viewerState, mediaItems])

  const listGroups = groups

  const getItemSize = useCallback(
    (index: number) => estimateGroupRowHeight(listGroups[index], listWidth),
    [listGroups, listWidth]
  )

  const totalEstimatedHeight = useMemo(
    () =>
      listGroups.reduce((sum, _group, index) => sum + getItemSize(index), 0),
    [listGroups, getItemSize]
  )

  const listHeight =
    listGroups.length === 0
      ? 0
      : Math.max(
          320,
          Math.min(
            REVIEW_LIST_MAX_HEIGHT,
            Math.max(0, window.innerHeight - REVIEW_LIST_VIEWPORT_OFFSET),
            totalEstimatedHeight
          )
        )

  const virtualListData = useMemo<VirtualGroupListData>(
    () => ({
      groups: listGroups,
      mediaItems,
      selectedGroupIds,
      keptByGroupId,
      onToggleGroup,
      onToggleKept,
      onTrashAll,
      onOpenViewer,
      readOnly
    }),
    [
      listGroups,
      mediaItems,
      selectedGroupIds,
      keptByGroupId,
      onToggleGroup,
      onToggleKept,
      onTrashAll,
      onOpenViewer,
      readOnly
    ]
  )

  useEffect(() => {
    listRef.current?.resetAfterIndex(0, true)
  }, [listGroups, listWidth])

  if (groups.length === 0) {
    const totalItems = Object.keys(mediaItems).length
    return (
      <Box sx={{ textAlign: "center", py: 8 }}>
        <Typography variant="h6" color="text.secondary" gutterBottom>
          No duplicates found
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Checked {totalItems.toLocaleString()} photos and videos. No duplicate
          sets were found with the current match sensitivity.
        </Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ pb: 6 }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 2,
          mb: 1.5
        }}>
        <Box>
          <Typography variant="h6">
            {heading ??
              `${groups.length} Duplicate Set${groups.length !== 1 ? "s" : ""} Ready`}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Pick what stays, or use Trash all copies for a set you do not want
            to keep.
          </Typography>
        </Box>
      </Box>

      {listGroups.length > 0 && (
        <Box ref={listContainerRef} data-testid="duplicate-groups-virtual-list">
          <VariableSizeList
            ref={listRef}
            height={listHeight}
            width="100%"
            itemCount={listGroups.length}
            itemSize={getItemSize}
            itemData={virtualListData}
            overscanCount={3}
            style={sxVirtualList}>
            {VirtualGroupRow}
          </VariableSizeList>
        </Box>
      )}

      {/* Photo viewer modal — rendered once outside the map, state drives which photo */}
      {viewerState && (
        <PhotoViewerModal
          open={true}
          items={viewerItems}
          initialIndex={viewerState.index}
          keptSet={keptByGroupId.get(viewerState.group.id)!}
          isGroupSelected={selectedGroupIds.has(viewerState.group.id)}
          onClose={() => setViewerState(null)}
          onToggleKept={
            readOnly
              ? undefined
              : (mediaKey) => onToggleKept(viewerState.group, mediaKey)
          }
          onToggleGroup={
            readOnly ? undefined : () => onToggleGroup(viewerState.group.id)
          }
          onNextGroup={handleNextGroup}
          onPrevGroup={handlePrevGroup}
        />
      )}
    </Box>
  )
}
