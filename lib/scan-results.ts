/**
 * Returns true if stored scan results are valid for the given context.
 * Used by both the UI (mount load, incremental cache) and the reducer
 * (health check) so future invalidation conditions only need to be added here.
 */
export function areScanResultsValid(
  stored: { accountEmail?: string },
  context: { accountEmail?: string },
): boolean {
  // Once the current account is known, unknown-account saved results are not
  // safe to reuse for review/trash actions.
  if (!stored.accountEmail && context.accountEmail) return false;
  // Account mismatch: results belong to a different account
  if (stored.accountEmail && context.accountEmail && stored.accountEmail !== context.accountEmail)
    return false;
  return true;
}
