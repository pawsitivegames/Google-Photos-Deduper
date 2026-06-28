import ExpandMoreIcon from "@mui/icons-material/ExpandMore"
import SearchRoundedIcon from "@mui/icons-material/SearchRounded"
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded"
import Accordion from "@mui/material/Accordion"
import AccordionDetails from "@mui/material/AccordionDetails"
import AccordionSummary from "@mui/material/AccordionSummary"
import Alert from "@mui/material/Alert"
import Box from "@mui/material/Box"
import Button from "@mui/material/Button"
import MenuItem from "@mui/material/MenuItem"
import Paper from "@mui/material/Paper"
import Slider from "@mui/material/Slider"
import Stack from "@mui/material/Stack"
import TextField from "@mui/material/TextField"
import ToggleButton from "@mui/material/ToggleButton"
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup"
import Typography from "@mui/material/Typography"

import { FULL_SCAN_BLOCK_SIZE } from "../lib/duplicate-detector"
import type { ScanCheckpoint } from "../lib/scan-checkpoint"
import {
  describeScanCheckpointResume,
  summarizeScanCheckpoint
} from "../lib/scan-checkpoint"
import type { GpdAlbum, ScanSettings } from "../lib/types"

function formatWindow(sec: number): string {
  if (sec < 60) return `${sec}s`
  if (sec < 3600) return `${Math.round(sec / 60)}m`
  if (sec < 86400) return `${Math.round(sec / 3600)}h`
  if (sec < 604800) return `${Math.round(sec / 86400)}d`
  return `${Math.round(sec / 604800)}w`
}

function isDateRangeInvalid(settings: ScanSettings): boolean {
  const from = settings.dateRange?.from
  const to = settings.dateRange?.to
  return !!(from && to && from > to)
}

interface ScanConfigProps {
  settings: ScanSettings
  onSettingsChange: (settings: Partial<ScanSettings>) => void
  onStartScan: () => void
  onResumeScan?: () => void
  onDismissResume?: () => void
  onClearCache: () => void
  onRebuildCache: () => void
  onExportCacheDiagnostics: () => void
  hasGptk: boolean
  cacheEntryCount: number | null
  cacheStatus?: string
  cacheBusy?: boolean
  resumeCheckpoint?: ScanCheckpoint | null
  albums?: GpdAlbum[]
  albumsLoading?: boolean
  albumsError?: string | null
  onRefreshAlbums?: () => void
}

export function ScanConfig({
  settings,
  onSettingsChange,
  onStartScan,
  onResumeScan,
  onDismissResume,
  onClearCache,
  onRebuildCache,
  onExportCacheDiagnostics,
  hasGptk,
  cacheEntryCount,
  cacheStatus,
  cacheBusy = false,
  resumeCheckpoint,
  albums = [],
  albumsLoading = false,
  albumsError = null,
  onRefreshAlbums
}: ScanConfigProps) {
  const dateRangeInvalid = isDateRangeInvalid(settings)
  const albumLabel = settings.albumScope?.title || settings.albumScope?.mediaKey
  const hasScanScope = Boolean(
    settings.albumScope || settings.dateRange?.from || settings.dateRange?.to
  )
  const showUnscopedFullScanWarning =
    settings.scanMode === "full" && !hasScanScope

  if (!hasGptk) {
    return (
      <Box sx={{ maxWidth: 480, mx: "auto", p: 4 }}>
        <Alert severity="warning" icon={<WarningAmberRoundedIcon />}>
          GPTK is not loaded on the Google Photos page. Please reload
          photos.google.com and try again.
        </Alert>
      </Box>
    )
  }

  return (
    <Box sx={{ maxWidth: 480, mx: "auto", p: 4 }}>
      <Paper
        elevation={0}
        sx={{
          p: 4,
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 2
        }}>
        <Typography variant="h5" fontWeight={600} gutterBottom>
          Scan for Duplicates
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
          Scan your Google Photos library to find duplicate images using
          AI-powered image comparison.
        </Typography>

        {resumeCheckpoint && (
          <Alert
            severity={resumeCheckpoint.status === "error" ? "warning" : "info"}
            sx={{ mb: 2 }}
            action={
              onDismissResume && (
                <Button color="inherit" size="small" onClick={onDismissResume}>
                  Dismiss
                </Button>
              )
            }>
            Previous {summarizeScanCheckpoint(resumeCheckpoint)} stopped during{" "}
            {resumeCheckpoint.phase.replace(/_/g, " ")}.{" "}
            {describeScanCheckpointResume(resumeCheckpoint)}
          </Alert>
        )}

        {resumeCheckpoint && onResumeScan && (
          <Button
            variant="outlined"
            fullWidth
            size="large"
            onClick={onResumeScan}
            disabled={dateRangeInvalid}
            sx={{ mb: 2 }}>
            Resume Scan
          </Button>
        )}

        <Button
          variant="contained"
          fullWidth
          size="large"
          startIcon={<SearchRoundedIcon />}
          onClick={() => onStartScan()}
          disabled={dateRangeInvalid}
          sx={{ mb: 2 }}>
          {settings.albumScope
            ? "Scan Album"
            : settings.dateRange?.from || settings.dateRange?.to
              ? "Scan Date Range"
              : "Scan Library"}
        </Button>

        {showUnscopedFullScanWarning && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Full-library comparison can be slow and memory-heavy on large Google
            Photos libraries. Full mode compares every item pair in{" "}
            {FULL_SCAN_BLOCK_SIZE.toLocaleString()}-item blocks, so it can catch
            duplicates uploaded years apart without loading the whole comparison
            matrix at once.
          </Alert>
        )}

        {dateRangeInvalid && (
          <Alert severity="error" sx={{ mb: 2 }}>
            The start date must be before the end date.
          </Alert>
        )}

        <Accordion
          disableGutters
          elevation={0}
          sx={{
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 1,
            "&:before": { display: "none" }
          }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="body2" color="text.secondary">
              More options
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Box sx={{ mb: 3 }}>
              <Typography variant="body2" fontWeight={500} sx={{ mb: 1 }}>
                Scan mode
              </Typography>
              <ToggleButtonGroup
                value={settings.scanMode}
                exclusive
                size="small"
                fullWidth
                onChange={(_, value) => {
                  if (value !== null) onSettingsChange({ scanMode: value })
                }}>
                <ToggleButton value="smart">Smart</ToggleButton>
                <ToggleButton value="full">Full</ToggleButton>
              </ToggleButtonGroup>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "block", mt: 0.5 }}>
                {settings.scanMode === "smart"
                  ? "Only compares photos taken at the same time — fast for large libraries."
                  : `Compares all photos against each other in ${FULL_SCAN_BLOCK_SIZE.toLocaleString()}-item blocks.`}
              </Typography>
            </Box>

            {settings.scanMode === "smart" && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="body2" fontWeight={500} sx={{ mb: 1 }}>
                  Time window:{" "}
                  <strong>{formatWindow(settings.smartWindowSec ?? 1)}</strong>
                </Typography>
                <ToggleButtonGroup
                  value={settings.smartWindowSec ?? 1}
                  exclusive
                  size="small"
                  fullWidth
                  onChange={(_, value) => {
                    if (value !== null)
                      onSettingsChange({ smartWindowSec: value })
                  }}>
                  <ToggleButton value={1}>1s</ToggleButton>
                  <ToggleButton value={60}>1m</ToggleButton>
                  <ToggleButton value={3600}>1h</ToggleButton>
                  <ToggleButton value={86400}>1d</ToggleButton>
                  <ToggleButton value={604800}>1w</ToggleButton>
                </ToggleButtonGroup>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: "block", mt: 0.5 }}>
                  How close in time items must be to be compared. Widen this to
                  catch re-saved videos whose EXIF date was rewritten — at the
                  cost of more pairs to check.
                </Typography>
              </Box>
            )}

            <Box sx={{ mb: 3 }}>
              <Typography variant="body2" fontWeight={500} sx={{ mb: 1 }}>
                Album
              </Typography>
              <TextField
                select
                label="Album"
                size="small"
                fullWidth
                value={settings.albumScope?.mediaKey ?? ""}
                helperText={
                  albumLabel
                    ? `Scanning only ${albumLabel}.`
                    : "Leave blank to scan the library timeline."
                }
                onChange={(event) => {
                  const mediaKey = event.target.value
                  if (!mediaKey) {
                    onSettingsChange({ albumScope: undefined })
                    return
                  }
                  const album = albums.find((a) => a.mediaKey === mediaKey)
                  onSettingsChange({
                    albumScope: {
                      mediaKey,
                      title: album?.title,
                      itemCount: album?.itemCount,
                      isShared: album?.isShared
                    }
                  })
                }}>
                <MenuItem value="">Library timeline</MenuItem>
                {albums.map((album) => (
                  <MenuItem key={album.mediaKey} value={album.mediaKey}>
                    {album.title}
                    {album.itemCount !== undefined
                      ? ` (${album.itemCount.toLocaleString()})`
                      : ""}
                    {album.isShared ? " - shared" : ""}
                  </MenuItem>
                ))}
              </TextField>
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  mt: 1
                }}>
                <Typography variant="caption" color="text.secondary">
                  {albumsLoading
                    ? "Loading albums..."
                    : albumsError
                      ? albumsError
                      : `${albums.length.toLocaleString()} album${
                          albums.length !== 1 ? "s" : ""
                        } available.`}
                </Typography>
                {onRefreshAlbums && (
                  <Button
                    size="small"
                    disabled={albumsLoading}
                    onClick={onRefreshAlbums}>
                    Refresh
                  </Button>
                )}
              </Box>
            </Box>

            <Box sx={{ mb: 3 }}>
              <Typography variant="body2" fontWeight={500} sx={{ mb: 1 }}>
                Taken date range
              </Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <TextField
                  label="From"
                  type="date"
                  size="small"
                  fullWidth
                  value={settings.dateRange?.from ?? ""}
                  InputLabelProps={{ shrink: true }}
                  onChange={(event) =>
                    onSettingsChange({
                      dateRange: {
                        ...settings.dateRange,
                        from: event.target.value || undefined
                      }
                    })
                  }
                />
                <TextField
                  label="To"
                  type="date"
                  size="small"
                  fullWidth
                  value={settings.dateRange?.to ?? ""}
                  InputLabelProps={{ shrink: true }}
                  onChange={(event) =>
                    onSettingsChange({
                      dateRange: {
                        ...settings.dateRange,
                        to: event.target.value || undefined
                      }
                    })
                  }
                />
              </Stack>
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  mt: 1
                }}>
                <Typography variant="caption" color="text.secondary">
                  Leave blank to scan every taken date.
                </Typography>
                {(settings.dateRange?.from || settings.dateRange?.to) && (
                  <Button
                    size="small"
                    onClick={() => onSettingsChange({ dateRange: undefined })}>
                    Clear
                  </Button>
                )}
              </Box>
            </Box>

            <Box>
              <Typography variant="body2" fontWeight={500} sx={{ mb: 1 }}>
                Similarity Threshold:{" "}
                <strong>{settings.similarityThreshold}</strong>
              </Typography>
              <Slider
                min={0.9}
                max={1.0}
                step={0.01}
                value={settings.similarityThreshold}
                valueLabelDisplay="auto"
                onChange={(_, value) =>
                  onSettingsChange({ similarityThreshold: value as number })
                }
              />
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  mt: 0.5
                }}>
                <Typography variant="caption" color="text.secondary">
                  More matches
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Stricter
                </Typography>
              </Box>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "block", mt: 1 }}>
                Lower values catch more reuploads and edited copies; review
                similar groups before trashing.
              </Typography>
            </Box>

            <Box sx={{ mt: 3 }}>
              <Typography variant="body2" fontWeight={500} sx={{ mb: 1 }}>
                Embedding cache
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "block", mb: 1 }}>
                {cacheEntryCount === null
                  ? "Cache size unavailable."
                  : `${cacheEntryCount.toLocaleString()} cached embedding${
                      cacheEntryCount !== 1 ? "s" : ""
                    }.`}
              </Typography>
              {cacheStatus && (
                <Alert severity="info" sx={{ mb: 1 }}>
                  {cacheStatus}
                </Alert>
              )}
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <Button
                  variant="outlined"
                  size="small"
                  disabled={cacheBusy}
                  onClick={onClearCache}>
                  Clear Cache
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  disabled={cacheBusy || dateRangeInvalid}
                  onClick={onRebuildCache}>
                  Rebuild Cache
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  disabled={cacheBusy || cacheEntryCount === 0}
                  onClick={onExportCacheDiagnostics}>
                  Export Diagnostics
                </Button>
              </Stack>
            </Box>
          </AccordionDetails>
        </Accordion>
      </Paper>
    </Box>
  )
}
