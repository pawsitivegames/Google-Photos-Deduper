# Validation Checklist

Use this checklist before trusting Google Photos Deduper on a main library.

## Automated Gates

Run these from the repository root:

```bash
npm run build
npm test
npx playwright test --config playwright.config.ts tests/e2e/integration/app-tab.test.ts tests/e2e/integration/trash-undo.test.ts
```

Required result:

- The extension builds without errors.
- Unit tests pass.
- Stubbed extension integration tests pass.
- Trash tests pass typed confirmation, conservative batching, result reporting, failure display, and undo.

These checks prove the local product flow and safety logic. They do not prove that the current Google Photos web app still accepts every GPTK operation.

## Live Tiny-Album Gate

Use a non-critical Google account or a tiny test album first.

Recommended command:

```bash
GPD_E2E_ALBUM_TITLE="Tiny duplicate test" npm run test:e2e
```

To validate a date range instead:

```bash
GPD_E2E_DATE_FROM="2026-01-01" GPD_E2E_DATE_TO="2026-01-31" npm run test:e2e
```

1. Create or choose a tiny album with two duplicate test photos and at least one non-duplicate.
2. Open `photos.google.com` in Chrome and confirm the intended account is signed in.
3. Load the unpacked extension from `build/chrome-mv3-prod` or `build/chrome-mv3-dev`.
4. Open Deduper and confirm the app shows the expected signed-in account.
5. Choose the tiny album scope.
6. Run a Smart scan.
7. Confirm the scan result only contains the expected duplicate group.
8. Export JSON and CSV reports.
9. Confirm the reports list the expected keep item, Trash candidate, group id, similarity, reason, timestamp, and Google Photos link.
10. Click **Move to Trash**.
11. Confirm the dialog requires typing the exact item count before the final button enables.
12. Move only the expected duplicate to Trash.
13. Confirm the Trash result report shows the expected moved item and no unexpected failures.
14. Open Google Photos Trash and restore the test item.
15. Confirm the restored item appears back in Google Photos.

Required result:

- No unrelated media is selected or moved.
- The pre-Trash report is saved before the Trash operation.
- The Trash result report matches the actual Google Photos outcome.
- Restore from Google Photos Trash works for the moved item.

## Live Account Smoke Test - 2026-06-28

Environment:

- Chrome normal profile, signed in to Google Photos as `mustumasti@gmail.com`.
- Unpacked dev extension loaded from `build/chrome-mv3-dev`.
- Runtime extension id: `efdneecimbdbeafpllggkmahiehhimhn`.
- No Trash/delete operation was performed.

Evidence:

- Extension manager showed `Google Photos Deduper 2.2.1` enabled.
- Google Photos page injected the extension scripts:
  - `scripts/unsafewindow-shim.js`
  - `scripts/google-photos-toolkit.user.js`
  - `scripts/google-photos-commands.js`
- Bridge health check returned `hasGptk=true`, `hasWizData=true`, and account email `mustumasti@gmail.com`.
- Direct scoped fetch for taken date `2026-06-21` returned 7 media items with thumbnails.
- App scoped Smart scan for `2026-06-21` reached 7 processed items and completed with `No duplicates found in your library.`
- App scoped Full scan for `2026-06-21` reached 7 processed items and completed with `No duplicates found in your library.`

Current caveat:

- Date-range scans still paginate from the newest Google Photos feed before filtering the requested taken-date range. The app now reports scanned-versus-matched progress, so older ranges should show movement even while no matching taken-date items have been reached yet.

## Live Duplicate-Positive Test - 2026-06-28

Environment:

- Chrome normal profile, signed in to Google Photos as `mustafa.dungar@gmail.com`.
- Unpacked dev extension loaded from `build/chrome-mv3-dev`.
- Runtime extension id: `efdneecimbdbeafpllggkmahiehhimhn`.
- No Trash/delete operation was performed.

Setup:

- Generated two synthetic PNG images in `tmp-live-duplicate-test/`:
  - `gpd-live-duplicate-copy-1.png`
  - `gpd-live-duplicate-copy-2.png`
- Uploaded both synthetic images to Google Photos.
- Both appeared under `Today` in Google Photos.

Evidence:

- App scoped Full scan for taken date `2026-06-28` fetched 2 media items.
- The scan completed with `1 duplicate group`.
- Result summary showed:
  - `2 items scanned`
  - `ALL (1)`
  - `EXACT (0)`
  - `SIMILAR (1)`
  - `2 photos`
  - `99% similar`
  - one item marked `Keep`
  - one item marked `Trash`

Required cleanup:

- The two uploaded synthetic test images remain in Google Photos until explicitly moved to Trash or deleted by the account owner.

## Live Month/Year Gate

Run this only after the tiny-album gate passes.

The live Trash test is opt-in. It will skip unless `GPD_E2E_ALLOW_TRASH=1` is set:

```bash
GPD_E2E_ALBUM_TITLE="Tiny duplicate test" GPD_E2E_ALLOW_TRASH=1 npm run test:e2e
```

1. Choose a low-risk month or year with known duplicates.
2. Run Smart mode first.
3. Review all groups and skip anything uncertain.
4. Export JSON and CSV reports.
5. Move a small batch to Trash.
6. Compare the result report with Google Photos Trash.
7. Restore at least one item from the batch.

Required result:

- Browser remains responsive while reviewing results.
- Checkpoint/resume works if the tab is reloaded mid-scan.
- Cached embeddings make a repeated scan of the same scope faster.
- Trash result reporting remains accurate on multi-batch operations.

## Main-Library Operating Rules

- Do not start with an unscoped Full scan on a large library.
- Prefer Smart mode and one album, month, or year at a time.
- Export reports before every Trash operation.
- Keep batch sizes small until the live gates have passed repeatedly.
- Treat similar-photo groups as review-only; Trash only obvious duplicates.
- Keep Google Photos Trash recovery available until the full session is audited.
