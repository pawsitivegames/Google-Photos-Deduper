/**
 * Component tests for ActionBar.
 *
 * Covers:
 * - Stats display (items scanned, group count)
 * - Button visibility based on groupCount
 * - "Move to Trash" button disabled when duplicateCount === 0
 * - All callback props fire on the correct user action
 */
import { createTheme, ThemeProvider } from "@mui/material/styles"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { ActionBar } from "../../components/ActionBar"

const theme = createTheme()

interface Props {
  totalItems?: number
  groupCount?: number
  totalGroupCount?: number
  exactGroupCount?: number
  similarGroupCount?: number
  duplicateCount?: number
  reviewFilter?: "all" | "exact" | "similar"
  onReviewFilterChange?: (filter: "all" | "exact" | "similar") => void
  onSelectAll?: () => void
  onDeselectAll?: () => void
  onTrash?: () => void
  onRescan?: () => void
  onExportJson?: () => void
  onExportCsv?: () => void
  onApplyKeepStrategy?: (strategy: string) => void
}

function renderActionBar(props: Props = {}) {
  const defaults = {
    totalItems: 500,
    groupCount: 3,
    totalGroupCount: 3,
    exactGroupCount: 2,
    similarGroupCount: 1,
    duplicateCount: 6,
    reviewFilter: "all" as const,
    onReviewFilterChange: vi.fn(),
    onSelectAll: vi.fn(),
    onDeselectAll: vi.fn(),
    onTrash: vi.fn(),
    onRescan: vi.fn(),
    onExportJson: vi.fn(),
    onExportCsv: vi.fn(),
    onApplyKeepStrategy: vi.fn()
  }
  const merged = { ...defaults, ...props }
  return {
    ...render(
      <ThemeProvider theme={theme}>
        <ActionBar {...merged} />
      </ThemeProvider>
    ),
    callbacks: merged
  }
}

// ============================================================
// Tests
// ============================================================

describe("ActionBar", () => {
  describe("stats display", () => {
    it("shows the total items scanned count", () => {
      renderActionBar({ totalItems: 12345 })
      expect(
        screen.getByText("12,345 photos and videos checked")
      ).toBeInTheDocument()
    })

    it("shows the duplicate group count (plural)", () => {
      renderActionBar({ groupCount: 5 })
      expect(screen.getByText("5 duplicate sets to review")).toBeInTheDocument()
    })

    it("shows singular 'duplicate group' when groupCount is 1", () => {
      renderActionBar({ groupCount: 1 })
      expect(screen.getByText("1 duplicate set to review")).toBeInTheDocument()
    })

    it("shows filtered and total group counts when a filter is active", () => {
      renderActionBar({
        groupCount: 2,
        totalGroupCount: 5,
        reviewFilter: "exact"
      })
      expect(screen.getByText("2 duplicate sets to review")).toBeInTheDocument()
      expect(screen.getByText("5 sets total")).toBeInTheDocument()
    })
  })

  describe("button visibility", () => {
    it("does not render action buttons when groupCount is 0", () => {
      renderActionBar({ groupCount: 0, totalGroupCount: 0 })
      expect(
        screen.queryByRole("button", { name: /Scan again/i })
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole("button", { name: /Include all/i })
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole("button", { name: /Trash/i })
      ).not.toBeInTheDocument()
    })

    it("renders action buttons when groupCount > 0", () => {
      renderActionBar({ groupCount: 2 })
      expect(
        screen.getByRole("button", { name: /Scan again/i })
      ).toBeInTheDocument()
      expect(
        screen.getByRole("button", { name: /^Export report$/i })
      ).toBeInTheDocument()
      expect(
        screen.getByRole("button", { name: /^Spreadsheet$/i })
      ).toBeInTheDocument()
      expect(
        screen.getByRole("button", { name: /^Include all$/i })
      ).toBeInTheDocument()
      expect(
        screen.getByRole("button", { name: /^Skip all$/i })
      ).toBeInTheDocument()
      expect(
        screen.getByRole("button", { name: /Auto Keep/i })
      ).toBeInTheDocument()
      expect(
        screen.getByRole("button", { name: /All sets \(3\)/i })
      ).toBeInTheDocument()
      expect(
        screen.getByRole("button", { name: /Identical \(2\)/i })
      ).toBeInTheDocument()
      expect(
        screen.getByRole("button", { name: /Similar \(1\)/i })
      ).toBeInTheDocument()
    })

    it("keeps filter buttons visible when the active filter has no groups", () => {
      renderActionBar({ groupCount: 0, totalGroupCount: 3 })
      expect(
        screen.getByRole("button", { name: /All sets \(3\)/i })
      ).toBeInTheDocument()
      expect(screen.getByRole("button", { name: /Auto Keep/i })).toBeDisabled()
      expect(
        screen.getByRole("button", { name: /^Include all$/i })
      ).toBeDisabled()
    })
  })

  describe("Move to Trash button", () => {
    it("is enabled when duplicateCount > 0", () => {
      renderActionBar({ duplicateCount: 4 })
      const btn = screen.getByRole("button", {
        name: /Move 4 Duplicates to Trash/i
      })
      expect(btn).toBeEnabled()
    })

    it("is disabled when duplicateCount is 0", () => {
      renderActionBar({ duplicateCount: 0 })
      const btn = screen.getByRole("button", {
        name: /Move 0 Duplicates? to Trash/i
      })
      expect(btn).toBeDisabled()
    })

    it("shows singular 'Duplicate' when duplicateCount is 1", () => {
      renderActionBar({ duplicateCount: 1 })
      expect(
        screen.getByRole("button", { name: /Move 1 Duplicate to Trash/i })
      ).toBeInTheDocument()
    })
  })

  describe("callbacks", () => {
    it("calls onRescan when Scan again is clicked", () => {
      const { callbacks } = renderActionBar()
      fireEvent.click(screen.getByRole("button", { name: /Scan again/i }))
      expect(callbacks.onRescan).toHaveBeenCalledOnce()
    })

    it("calls onSelectAll when Include all is clicked", () => {
      const { callbacks } = renderActionBar()
      fireEvent.click(screen.getByRole("button", { name: /^Include all$/i }))
      expect(callbacks.onSelectAll).toHaveBeenCalledOnce()
    })

    it("calls onDeselectAll when Skip all is clicked", () => {
      const { callbacks } = renderActionBar()
      fireEvent.click(screen.getByRole("button", { name: /Skip all/i }))
      expect(callbacks.onDeselectAll).toHaveBeenCalledOnce()
    })

    it("calls onReviewFilterChange when a filter is clicked", () => {
      const { callbacks } = renderActionBar()
      fireEvent.click(screen.getByRole("button", { name: /Identical \(2\)/i }))
      expect(callbacks.onReviewFilterChange).toHaveBeenCalledWith("exact")
    })

    it("calls onTrash when Move to Trash is clicked", () => {
      const { callbacks } = renderActionBar({ duplicateCount: 3 })
      fireEvent.click(
        screen.getByRole("button", { name: /Move 3 Duplicates to Trash/i })
      )
      expect(callbacks.onTrash).toHaveBeenCalledOnce()
    })

    it("calls export callbacks when report buttons are clicked", () => {
      const { callbacks } = renderActionBar()
      fireEvent.click(screen.getByRole("button", { name: /^Export report$/i }))
      fireEvent.click(screen.getByRole("button", { name: /^Spreadsheet$/i }))
      expect(callbacks.onExportJson).toHaveBeenCalledOnce()
      expect(callbacks.onExportCsv).toHaveBeenCalledOnce()
    })

    it("calls keep strategy callback from the Auto Keep menu", () => {
      const { callbacks } = renderActionBar()
      fireEvent.click(screen.getByRole("button", { name: /Auto Keep/i }))
      fireEvent.click(
        screen.getByRole("menuitem", { name: /Largest resolution/i })
      )
      expect(callbacks.onApplyKeepStrategy).toHaveBeenCalledWith(
        "largest_resolution"
      )
    })

    it("shows the non-storage-counting keep strategy", () => {
      const { callbacks } = renderActionBar()
      fireEvent.click(screen.getByRole("button", { name: /Auto Keep/i }))
      fireEvent.click(
        screen.getByRole("menuitem", { name: /Non-storage-counting/i })
      )
      expect(callbacks.onApplyKeepStrategy).toHaveBeenCalledWith(
        "non_storage_counting"
      )
    })

    it("does not call onTrash when button is disabled", () => {
      const { callbacks } = renderActionBar({ duplicateCount: 0 })
      const btn = screen.getByRole("button", {
        name: /Move 0 Duplicates? to Trash/i
      })
      fireEvent.click(btn)
      expect(callbacks.onTrash).not.toHaveBeenCalled()
    })
  })
})
