import CheckBoxOutlineBlankIcon from "@mui/icons-material/CheckBoxOutlineBlank"
import CheckBoxOutlinedIcon from "@mui/icons-material/CheckBoxOutlined"
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded"
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded"
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded"
import TuneRoundedIcon from "@mui/icons-material/TuneRounded"
import Box from "@mui/material/Box"
import Button from "@mui/material/Button"
import Divider from "@mui/material/Divider"
import Menu from "@mui/material/Menu"
import MenuItem from "@mui/material/MenuItem"
import Paper from "@mui/material/Paper"
import Stack from "@mui/material/Stack"
import ToggleButton from "@mui/material/ToggleButton"
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup"
import Typography from "@mui/material/Typography"
import { useState } from "react"

import { KEEP_STRATEGY_LABELS, type KeepStrategy } from "../lib/keep-strategy"

export type ReviewFilter = "all" | "exact" | "similar"

interface ActionBarProps {
  totalItems: number
  groupCount: number
  totalGroupCount: number
  exactGroupCount: number
  similarGroupCount: number
  duplicateCount: number
  reviewFilter: ReviewFilter
  onReviewFilterChange: (filter: ReviewFilter) => void
  onSelectAll: () => void
  onDeselectAll: () => void
  onTrash: () => void
  onRescan: () => void
  onExportJson: () => void
  onExportCsv: () => void
  onApplyKeepStrategy: (strategy: KeepStrategy) => void
  compact?: boolean
}

export function ActionBar({
  totalItems,
  groupCount,
  totalGroupCount,
  exactGroupCount,
  similarGroupCount,
  duplicateCount,
  reviewFilter,
  onReviewFilterChange,
  onSelectAll,
  onDeselectAll,
  onTrash,
  onRescan,
  onExportJson,
  onExportCsv,
  onApplyKeepStrategy,
  compact = false
}: ActionBarProps) {
  const [keepMenuAnchor, setKeepMenuAnchor] = useState<HTMLElement | null>(null)
  const keepMenuOpen = Boolean(keepMenuAnchor)

  return (
    <Paper
      elevation={0}
      sx={{
        position: "sticky",
        top: compact ? 48 : 80,
        zIndex: 9,
        px: compact ? 1 : { xs: 1.5, md: 2 },
        py: 1.25,
        mb: compact ? 1 : 2,
        borderRadius: compact ? 2 : 3,
        border: "1px solid",
        borderColor: "divider",
        bgcolor: compact ? "#FFFFFF" : "rgba(255,255,255,0.78)",
        backdropFilter: compact ? "none" : "saturate(180%) blur(24px)",
        boxShadow: compact ? "none" : "0 18px 48px rgba(0, 0, 0, 0.08)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: compact ? 1 : 1.5
      }}>
      <Box sx={{ minWidth: compact ? "100%" : { xs: "100%", sm: 240 } }}>
        <Typography variant="subtitle2" fontWeight={700}>
          {groupCount.toLocaleString()} duplicate set
          {groupCount !== 1 ? "s" : ""} to review
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {totalItems.toLocaleString()} photos and videos checked
          {groupCount !== totalGroupCount ? " · " : ""}
          {groupCount !== totalGroupCount && (
            <Box component="span">
              {totalGroupCount.toLocaleString()} sets total
            </Box>
          )}
        </Typography>
      </Box>

      {totalGroupCount > 0 && (
        <Stack
          direction="row"
          spacing={0.75}
          alignItems="center"
          flexWrap="wrap"
          useFlexGap
          sx={{ width: compact ? "100%" : "auto" }}>
          <ToggleButtonGroup
            value={reviewFilter}
            exclusive
            size="small"
            fullWidth={compact}
            aria-label="Review filter"
            onChange={(_, value) => {
              if (value !== null) onReviewFilterChange(value)
            }}>
            <ToggleButton value="all">
              All{compact ? "" : ` sets (${totalGroupCount.toLocaleString()})`}
            </ToggleButton>
            <ToggleButton value="exact">
              {compact
                ? "Exact"
                : `Identical (${exactGroupCount.toLocaleString()})`}
            </ToggleButton>
            <ToggleButton value="similar">
              Similar{compact ? "" : ` (${similarGroupCount.toLocaleString()})`}
            </ToggleButton>
          </ToggleButtonGroup>
          {!compact && (
            <Divider orientation="vertical" flexItem sx={{ my: 0.5 }} />
          )}
          <Button
            size="small"
            startIcon={<RefreshRoundedIcon />}
            onClick={onRescan}>
            Scan again
          </Button>
          <Button
            size="small"
            startIcon={<DownloadRoundedIcon />}
            onClick={onExportJson}>
            Export report
          </Button>
          <Button
            size="small"
            startIcon={<DownloadRoundedIcon />}
            onClick={onExportCsv}>
            Spreadsheet
          </Button>
          {!compact && (
            <Divider orientation="vertical" flexItem sx={{ my: 0.5 }} />
          )}
          <Button
            size="small"
            startIcon={<TuneRoundedIcon />}
            onClick={(event) => setKeepMenuAnchor(event.currentTarget)}
            disabled={groupCount === 0}
            aria-controls={keepMenuOpen ? "keep-strategy-menu" : undefined}
            aria-haspopup="menu"
            aria-expanded={keepMenuOpen ? "true" : undefined}>
            Auto Keep
          </Button>
          <Menu
            id="keep-strategy-menu"
            anchorEl={keepMenuAnchor}
            open={keepMenuOpen}
            onClose={() => setKeepMenuAnchor(null)}>
            {(Object.keys(KEEP_STRATEGY_LABELS) as KeepStrategy[]).map(
              (strategy) => (
                <MenuItem
                  key={strategy}
                  onClick={() => {
                    onApplyKeepStrategy(strategy)
                    setKeepMenuAnchor(null)
                  }}>
                  {KEEP_STRATEGY_LABELS[strategy]}
                </MenuItem>
              )
            )}
          </Menu>
          {!compact && (
            <Divider orientation="vertical" flexItem sx={{ my: 0.5 }} />
          )}
          <Button
            size="small"
            startIcon={<CheckBoxOutlinedIcon />}
            disabled={groupCount === 0}
            onClick={onSelectAll}>
            Include all
          </Button>
          <Button
            size="small"
            startIcon={<CheckBoxOutlineBlankIcon />}
            disabled={groupCount === 0}
            onClick={onDeselectAll}>
            Skip all
          </Button>
          {!compact && (
            <Divider orientation="vertical" flexItem sx={{ my: 0.5 }} />
          )}
          <Button
            variant="contained"
            color="error"
            size="small"
            startIcon={<DeleteOutlineRoundedIcon />}
            disabled={duplicateCount === 0}
            onClick={onTrash}
            sx={compact ? { width: "100%" } : undefined}>
            {compact
              ? `Move ${duplicateCount} to Trash`
              : `Move ${duplicateCount} Duplicate${
                  duplicateCount !== 1 ? "s" : ""
                } to Trash`}
          </Button>
        </Stack>
      )}
    </Paper>
  )
}
