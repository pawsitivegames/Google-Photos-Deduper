import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded"
import RadioButtonUncheckedRoundedIcon from "@mui/icons-material/RadioButtonUncheckedRounded"
import Alert from "@mui/material/Alert"
import Box from "@mui/material/Box"
import Button from "@mui/material/Button"
import CircularProgress from "@mui/material/CircularProgress"
import LinearProgress from "@mui/material/LinearProgress"
import Paper from "@mui/material/Paper"
import Stack from "@mui/material/Stack"
import Typography from "@mui/material/Typography"
import { useEffect, useRef, useState } from "react"

import type { ScanPhase } from "../lib/types"

interface ScanProgressProps {
  phase: ScanPhase
  itemsProcessed: number
  totalEstimate: number
  message: string
  onPause?: () => void
  idleWarningMs?: number
}

const PHASE_LABELS: Record<ScanPhase, string> = {
  fetching: "Reading your library",
  downloading_thumbnails: "Loading previews",
  computing_embeddings: "Comparing photos and videos",
  detecting_duplicates: "Preparing review sets",
  complete: "Complete"
}

const PHASE_STEP: Record<ScanPhase, number> = {
  fetching: 1,
  downloading_thumbnails: 2,
  computing_embeddings: 3,
  detecting_duplicates: 4,
  complete: 4
}

const TOTAL_STEPS = 4

function formatEtr(seconds: number): string {
  if (seconds < 60) return `${Math.ceil(seconds)}s remaining`
  if (seconds < 3600) {
    const mins = Math.floor(seconds / 60)
    const secs = Math.ceil(seconds % 60)
    return secs > 0 ? `${mins}m ${secs}s remaining` : `${mins}m remaining`
  }
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.round((seconds % 3600) / 60)
  return mins > 0 ? `${hrs}h ${mins}m remaining` : `${hrs}h remaining`
}

export function ScanProgress({
  phase,
  itemsProcessed,
  totalEstimate,
  message,
  onPause,
  idleWarningMs = 120_000
}: ScanProgressProps) {
  const [idleMs, setIdleMs] = useState(0)
  const lastProgressAtRef = useRef(Date.now())
  const progressSignature = `${phase}:${itemsProcessed}:${totalEstimate}:${message}`

  useEffect(() => {
    lastProgressAtRef.current = Date.now()
    setIdleMs(0)
  }, [progressSignature])

  useEffect(() => {
    const interval = window.setInterval(() => {
      setIdleMs(Date.now() - lastProgressAtRef.current)
    }, 1000)
    return () => window.clearInterval(interval)
  }, [])

  const progress =
    totalEstimate > 0 ? Math.round((itemsProcessed / totalEstimate) * 100) : 0
  const isDeterminate = totalEstimate > 0
  const showIdleWarning = idleMs >= idleWarningMs
  const idleMinutes = Math.max(1, Math.floor(idleMs / 60_000))

  const phaseStartRef = useRef<{
    phase: ScanPhase
    time: number
    baseItems: number
  } | null>(null)
  if (phaseStartRef.current?.phase !== phase) {
    phaseStartRef.current = {
      phase,
      time: Date.now(),
      baseItems: itemsProcessed
    }
  }

  const cachedEtrRef = useRef<{ text: string; updatedAt: number } | null>(null)

  if (isDeterminate && phaseStartRef.current) {
    const now = Date.now()
    if (!cachedEtrRef.current || now - cachedEtrRef.current.updatedAt >= 1000) {
      const elapsedSec = (now - phaseStartRef.current.time) / 1000
      const processedSince = itemsProcessed - phaseStartRef.current.baseItems
      if (processedSince > 0 && elapsedSec >= 3) {
        const rate = processedSince / elapsedSec
        const remaining = (totalEstimate - itemsProcessed) / rate
        if (remaining > 0) {
          cachedEtrRef.current = { text: formatEtr(remaining), updatedAt: now }
        }
      }
    }
  } else {
    cachedEtrRef.current = null
  }

  const etaText = cachedEtrRef.current?.text ?? null
  const stepNum = PHASE_STEP[phase]

  return (
    <Box sx={{ maxWidth: 860, mx: "auto", py: { xs: 2, md: 6 } }}>
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2.5, md: 4 },
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 3,
          bgcolor: "rgba(255,255,255,0.78)",
          backdropFilter: "saturate(180%) blur(22px)",
          boxShadow: "0 24px 70px rgba(0, 0, 0, 0.08)"
        }}>
        <Typography variant="h5" gutterBottom>
          Finding Duplicates
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Checking your library and preparing clear review sets.
        </Typography>

        {showIdleWarning && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            No scan progress for {idleMinutes} minute
            {idleMinutes === 1 ? "" : "s"}. The scan may still recover, but you
            can pause and resume if it stays stuck.
          </Alert>
        )}

        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={1}
          sx={{ mb: 3 }}>
          {(Object.keys(PHASE_STEP) as ScanPhase[])
            .filter((step) => step !== "complete")
            .map((step) => {
              const complete =
                PHASE_STEP[step] < stepNum || phase === "complete"
              const active = step === phase
              return (
                <Box
                  key={step}
                  sx={{
                    flex: 1,
                    p: 1.25,
                    border: "1px solid",
                    borderColor: active ? "primary.main" : "divider",
                    borderRadius: 2,
                    bgcolor: active ? "primary.light" : "background.paper",
                    display: "flex",
                    alignItems: "center",
                    gap: 1
                  }}>
                  {complete ? (
                    <CheckCircleRoundedIcon color="success" fontSize="small" />
                  ) : active ? (
                    <CircularProgress size={16} thickness={5} />
                  ) : (
                    <RadioButtonUncheckedRoundedIcon
                      color="disabled"
                      fontSize="small"
                    />
                  )}
                  <Typography variant="caption" fontWeight={700}>
                    {PHASE_LABELS[step]}
                  </Typography>
                </Box>
              )
            })}
        </Stack>

        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            mb: 2
          }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <CircularProgress size={14} thickness={5} />
            <Typography variant="body2" color="text.secondary">
              {phase === "complete"
                ? PHASE_LABELS[phase]
                : `Current: ${PHASE_LABELS[phase]}`}
            </Typography>
          </Box>
          <Typography variant="caption" color="text.secondary">
            Step {stepNum} of {TOTAL_STEPS}
          </Typography>
        </Box>

        <LinearProgress
          variant={isDeterminate ? "determinate" : "indeterminate"}
          value={progress}
          sx={{ mb: 1 }}
        />

        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}>
          <Typography variant="caption" color="text.secondary">
            {isDeterminate
              ? `${itemsProcessed.toLocaleString()} of ${totalEstimate.toLocaleString()} checked`
              : `${itemsProcessed.toLocaleString()} checked`}
          </Typography>
          {isDeterminate && (
            <Typography variant="caption" color="text.secondary">
              {etaText ? `${progress}% · ${etaText}` : `${progress}%`}
            </Typography>
          )}
        </Box>

        {onPause && (
          <Box sx={{ mt: 3 }}>
            <Button
              variant="outlined"
              color="inherit"
              size="small"
              onClick={onPause}>
              Pause Scan
            </Button>
          </Box>
        )}
      </Paper>
    </Box>
  )
}
