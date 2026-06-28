import CheckBoxOutlineBlankIcon from "@mui/icons-material/CheckBoxOutlineBlank"
import CheckBoxOutlinedIcon from "@mui/icons-material/CheckBoxOutlined"
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded"
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded"
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded"
import TuneRoundedIcon from "@mui/icons-material/TuneRounded"
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
  onApplyKeepStrategy
}: ActionBarProps) {
  const [keepMenuAnchor, setKeepMenuAnchor] = useState<HTMLElement | null>(null)
  const keepMenuOpen = Boolean(keepMenuAnchor)

  return (
    <Paper
      elevation={1}
      sx={{
        position: "sticky",
        top: 64, // below the AppBar (64px standard Toolbar height)
        zIndex: 9,
        px: 3,
        py: 1,
        borderRadius: 0,
        borderBottom: "1px solid",
        borderColor: "divider",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 1.5
      }}>
      <Stack
        direction="row"
        alignItems="center"
        divider={<Divider orientation="vertical" flexItem />}
        spacing={1.5}>
        <Typography variant="body2" color="text.secondary">
          {totalItems.toLocaleString()} items scanned
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {groupCount} duplicate group{groupCount !== 1 ? "s" : ""}
        </Typography>
        {groupCount !== totalGroupCount && (
          <Typography variant="body2" color="text.secondary">
            {totalGroupCount} total
          </Typography>
        )}
      </Stack>

      {totalGroupCount > 0 && (
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <ToggleButtonGroup
            value={reviewFilter}
            exclusive
            size="small"
            aria-label="Review filter"
            onChange={(_, value) => {
              if (value !== null) onReviewFilterChange(value)
            }}>
            <ToggleButton value="all">
              All ({totalGroupCount.toLocaleString()})
            </ToggleButton>
            <ToggleButton value="exact">
              Exact ({exactGroupCount.toLocaleString()})
            </ToggleButton>
            <ToggleButton value="similar">
              Similar ({similarGroupCount.toLocaleString()})
            </ToggleButton>
          </ToggleButtonGroup>
          <Divider orientation="vertical" flexItem sx={{ my: 0.5 }} />
          <Button
            size="small"
            startIcon={<RefreshRoundedIcon />}
            onClick={onRescan}>
            Re-scan
          </Button>
          <Button
            size="small"
            startIcon={<DownloadRoundedIcon />}
            onClick={onExportJson}>
            JSON
          </Button>
          <Button
            size="small"
            startIcon={<DownloadRoundedIcon />}
            onClick={onExportCsv}>
            CSV
          </Button>
          <Divider orientation="vertical" flexItem sx={{ my: 0.5 }} />
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
          <Divider orientation="vertical" flexItem sx={{ my: 0.5 }} />
          <Button
            size="small"
            startIcon={<CheckBoxOutlinedIcon />}
            disabled={groupCount === 0}
            onClick={onSelectAll}>
            Select All
          </Button>
          <Button
            size="small"
            startIcon={<CheckBoxOutlineBlankIcon />}
            disabled={groupCount === 0}
            onClick={onDeselectAll}>
            Deselect All
          </Button>
          <Divider orientation="vertical" flexItem sx={{ my: 0.5 }} />
          <Button
            variant="contained"
            color="error"
            size="small"
            startIcon={<DeleteOutlineRoundedIcon />}
            disabled={duplicateCount === 0}
            onClick={onTrash}>
            Move {duplicateCount} Duplicate{duplicateCount !== 1 ? "s" : ""} to
            Trash
          </Button>
        </Stack>
      )}
    </Paper>
  )
}
