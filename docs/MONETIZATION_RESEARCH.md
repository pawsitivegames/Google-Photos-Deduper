# Monetization, Naming, and Gating Research

Research date: 2026-06-29

Project context: this repository is a Plasmo/Chrome extension for finding duplicate photos in Google Photos, with work in progress for iCloud Photos and Amazon Photos. The current trust promise is local-first duplicate detection, no OAuth setup, review before Trash, and no photo-analysis backend.

## Executive Recommendation

Use a privacy-first freemium model under the brand **PhotoSweep**.

Recommended launch package:

- Name: **PhotoSweep**
- Tagline: **Clean up duplicate photos without uploading your library.**
- Free tier: limited scan/review/report workflow that proves trust.
- Paid tier: unlock scale, bulk cleanup, advanced controls, large-library resume, and multi-provider support.
- Pricing: **$9 Cleanup Pass**, **$29 Lifetime Pro**, optional **$19/year Pro** later.
- Payment path: ExtensionPay for fastest launch, or Stripe Checkout plus a small license API for more control.
- Gate strategy: signed entitlements plus centralized feature checks. Treat it as commercial friction, not unbreakable DRM.

The product should not monetize with ads, affiliate injection, or data sharing. That would conflict with Chrome Web Store policy pressure and the product's strongest market advantage: private local analysis.

## Why This Product Can Monetize

The extension solves a painful, recurring, high-trust problem:

- Users accumulate duplicate photos through imports, phone migrations, backups, downloads, and shared albums.
- Google Photos does not expose a strong built-in duplicate cleanup workflow.
- Users are nervous about deleting memories.
- Users do not want to upload private photos to another analysis service.
- Storage pressure creates a visible willingness-to-pay moment.

Google One is a useful value anchor. As of this research, Google lists 15 GB included storage, 100 GB at $1.99/month, 2 TB at $9.99/month, and 5 TB at $19.99/month for Google Photos, Drive, and Gmail storage. That makes a $9 cleanup pass and $29 lifetime unlock easy to explain: one useful cleanup can delay or reduce the need for paid storage.

The product should avoid claiming guaranteed storage savings. Instead, say:

> PhotoSweep helps you find recoverable storage before buying more.

## Recommended Name

### Primary Name: PhotoSweep

Why it works:

- Short and memorable.
- Explains cleanup without implying unsafe deletion.
- Provider-neutral, so it can cover Google Photos, iCloud Photos, Amazon Photos, and future providers.
- More brandable than "Google Photos Deduper."
- Softer and safer than "PhotoDelete" or "CloneKiller."

Positioning sentence:

> PhotoSweep is a private duplicate photo cleaner for cloud photo libraries.

Recommended tagline:

> Clean up duplicate photos without uploading your library.

Recommended Chrome Web Store title:

> PhotoSweep: Duplicate Cleaner for Google Photos

This keeps the brand provider-neutral while preserving the highest-intent search phrase.

### Backup Names

| Name | Strength | Weakness |
| --- | --- | --- |
| PhotoSweep | Best balance of clarity, safety, and provider-neutral branding | Needs trademark/domain check |
| SnapSweep | Catchier and playful | Slightly less clear for non-phone photos |
| GallerySweep | Provider-neutral | Less direct than PhotoSweep |
| PhotoTidy | Friendly | May feel too lightweight |
| PhotoPrune | Strong cleanup metaphor | "Prune" may feel destructive |
| PhotoSlim | Strong storage angle | Can sound like compression |
| CloneCleaner | Very clear | Less premium, more technical |
| Duplicate Desk | Trustworthy | Less catchy |

### Naming Checks Still Needed

Before renaming:

- Trademark search.
- Chrome Web Store search.
- Domain search.
- GitHub organization/repo availability.
- Social handle availability.
- Avoid confusing similarity with existing apps such as PhotoSweeper.

## Market Positioning

### Core Position

PhotoSweep is the safe, local-first alternative to upload-based photo duplicate cleaners.

### Positioning Statement

For people with crowded Google Photos libraries, PhotoSweep is a privacy-first duplicate photo cleaner that scans locally in the browser and guides users through review-first cleanup. Unlike upload-based cleaners, PhotoSweep does not send photo analysis to a backend and does not permanently delete photos.

### Messaging Pillars

#### 1. Private by Design

Primary claim:

> Duplicate analysis runs locally in your browser.

Supporting points:

- No photo-analysis backend.
- No OAuth setup.
- Local cache that users can clear.
- Payment entitlement is separate from photo analysis.

#### 2. Review Before Trash

Primary claim:

> PhotoSweep finds candidates. You choose what moves to Trash.

Supporting points:

- Exact and similar groups are separated.
- Users choose keep items.
- Typed confirmation before Trash actions.
- Items move to provider Trash, not permanent deletion.
- Exportable report before cleanup.

#### 3. Built for Large Libraries

Primary claim:

> Work through years of photos in safe batches.

Supporting points:

- Album/date scoped scans.
- Checkpoint and resume.
- Cached embeddings.
- Reports and diagnostics.

#### 4. Storage Pressure

Primary claim:

> Find what is wasting storage before upgrading.

Supporting points:

- Show duplicate count.
- Show estimated recoverable storage.
- Compare against monthly storage subscriptions carefully, without promising exact savings.

## Competitive Pricing Research

The duplicate-photo cleanup category supports both one-time purchases and subscriptions.

Observed price anchors:

| Product | Model / Price Observed | Notes |
| --- | --- | --- |
| PhotoSweeper | $14.99 on Mac App Store | Mac-local duplicate/similar photo cleaner |
| Duplicate Photos Fixer Pro | $39.95 promotional PC price, with higher list price shown | Stronger upsell/discount style |
| Gemini-style mobile cleaners | Often around $20/year or $35 one-time in third-party references | Subscription fatigue is visible in user discussions |
| Remo-style tools | Free mobile variants, paid desktop variants in some references | Lower-end anchor |

Implication:

- $29 lifetime is credible for a focused browser extension.
- $39 lifetime is plausible after strong proof, testimonials, and provider expansion.
- $19/year is plausible if ongoing breakage fixes and multi-provider support are explicit.
- $9 for a short cleanup pass fits users who only need one session.

Recommended first public pricing:

| Plan | Price | Purpose |
| --- | ---: | --- |
| Free | $0 | Build trust and prove value |
| Cleanup Pass | $9 for 7 days | Capture one-time cleanup demand |
| Lifetime Pro | $29 | Primary conversion plan |

Add later:

| Plan | Price | Purpose |
| --- | ---: | --- |
| Annual Pro | $19/year | Fund ongoing maintenance |
| Family Pro | $49-$59 lifetime | Multi-account household use |

Avoid starting with only subscriptions. Photo cleanup often feels episodic, and users in this category can be subscription-resistant.

### Pricing Psychology

The pricing should be framed around risk reduction and storage savings, not raw software access.

Good framing:

> Run a careful cleanup before buying more storage.

Bad framing:

> Pay to delete more photos.

The user is already anxious about photo deletion. The paid promise should be "finish safely at scale," not "unlock deletion." This is why the Cleanup Pass is useful: it fits the mental model of a one-time project while leaving Lifetime Pro available for users with large or recurring libraries.

Recommended pricing page order:

1. Free
2. Lifetime Pro
3. Cleanup Pass

Even if the Cleanup Pass is the cheapest paid option, Lifetime Pro should be visually emphasized because it is the cleanest offer and avoids subscription fatigue.

### Price Testing Plan

Start with:

- Cleanup Pass: $9
- Lifetime Pro: $29

Then test:

- $39 Lifetime Pro after adding iCloud/Amazon support.
- $12 Cleanup Pass if conversion is strong and refunds are low.
- $19/year only after users demonstrate recurring usage or provider breakage creates a clear maintenance story.

Signals to watch:

- Upgrade screen view to purchase conversion.
- Refund rate.
- Support tickets per paid user.
- Number of paid users who clean more than one provider.
- Number of paid users who return after 30 days.
- Number of free users who hit the group/scan cap.

Decision rule:

- If most paid users complete one cleanup and never return, emphasize Cleanup Pass and Lifetime.
- If many users return monthly or across providers, introduce Annual Pro.
- If refund rate rises after raising lifetime price, move back to $29 and improve proof assets before retesting.

## Store and Policy Constraints

### Chrome Payments

Chrome Web Store native payments are deprecated. Google says developers who used Chrome Web Store payments must migrate to another payment processor and implement another way to track licenses.

Implication:

- Do not plan around native Chrome paid-extension checkout.
- Use a third-party payment processor and license system.
- The Chrome Web Store listing can distribute the extension, but payment/entitlement has to be handled elsewhere.

### Remote Hosted Code

Manifest V3 Chrome extensions must bundle executable code in the extension package. Chrome defines remotely hosted code as executable browser-loaded code outside the extension package, including JavaScript and WASM. JSON and CSS are treated differently, but executable code from a server is a review risk.

Implication:

- Do not load remote JavaScript payment SDKs inside extension pages.
- Bundle any extension-side payment helper code.
- Use remote APIs for data/entitlements, not remote executable logic.
- Be careful with Stripe/ExtensionPay snippets: the checkout page can be hosted externally, but extension logic should not dynamically load remote scripts into the extension.

### User Data and Privacy

Chrome Web Store policy requires an accurate privacy policy if the product handles user data. It also requires limited use, narrow permissions, clear disclosures, secure handling, and the narrowest permissions necessary for current features.

This extension handles sensitive user context even if it does not upload photo content:

- Photo library page access.
- Photo metadata and thumbnails during analysis.
- Potential storage estimates.
- User action reports.
- Payment email/license status if monetized.

Implication:

- Publish a privacy policy before monetization.
- Separate photo processing from payment processing in the policy.
- Disclose exactly what is stored locally.
- Disclose what is sent to the license server.
- Avoid collecting photo URLs, thumbnails, filenames, metadata, or page content for analytics.
- Use HTTPS for entitlement checks.
- Keep permissions explainable in the Chrome Web Store listing.

### Ads and Data Monetization

Chrome policies restrict user data transfer, sale, personalized advertising uses, and unrelated actions required to access advertised functionality.

Implication:

- Do not use ads inside this product.
- Do not sell or transfer photo-derived data.
- Do not inject affiliate links.
- Do not require unrelated survey/ad/signup actions to unlock promised cleanup functionality.

## Monetization Models Considered

### Model A: Fully Paid Extension

Description:

Require payment before meaningful use.

Pros:

- Simple positioning.
- No free users to support at large scale.

Cons:

- Bad for trust-heavy photo cleanup.
- Harder because users need proof before paying.
- Chrome native paid extension purchase is unavailable.
- Higher refund pressure.

Verdict:

Not recommended.

### Model B: Freemium With Scale Gates

Description:

Free users can scan/review limited results. Paid users unlock larger scans, bulk cleanup, resume, advanced controls, and provider expansion.

Pros:

- Lets users verify safety before paying.
- Converts after value is visible.
- Aligns payment with real utility.
- Keeps privacy story intact.

Cons:

- Requires careful entitlement and UX work.
- Some users will use only free limits.

Verdict:

Recommended.

### Model C: Cleanup Pass

Description:

Short paid window for one-time cleanup.

Pros:

- Matches episodic user need.
- Lower friction than lifetime.
- Honest for users who only need one pass.

Cons:

- Less recurring revenue.
- Needs clear expiry behavior.

Verdict:

Recommended as a secondary offer.

### Model D: Annual Subscription

Description:

Recurring Pro for ongoing updates and provider breakage fixes.

Pros:

- Supports maintenance.
- Good if Google/iCloud/Amazon UI breakages are frequent.
- Supports multi-provider roadmap.

Cons:

- Subscription resistance is likely.
- Users may feel cleanup is a one-time job.

Verdict:

Add later, or offer alongside lifetime.

### Model E: Ads, Affiliates, or Data Monetization

Description:

Revenue from ads, affiliate links, data, or recommendations.

Pros:

- No direct paywall.

Cons:

- Conflicts with privacy-first positioning.
- Store policy risk.
- Trust damage.
- Poor fit for sensitive photo libraries.

Verdict:

Do not use.

## Cross-Browser Distribution

### Chrome

Chrome should be the first commercial target because the current product is a Chrome extension and Google Photos cleanup is the strongest search-intent wedge.

Important constraints:

- Native Chrome Web Store payments are deprecated.
- Manifest V3 requires extension executable code to be bundled.
- Privacy disclosures need to be exact and conservative.
- The extension should avoid broad host permissions beyond supported providers.

Commercial implication:

- Chrome Web Store becomes the distribution and trust channel.
- Payment and licensing must be external.
- Store copy should focus on safety, privacy, and provider-specific value.

### Microsoft Edge Add-ons

Edge can be a low-effort second channel if the Chrome extension packages cleanly. The audience is smaller, but Edge users may be more desktop/productivity-oriented and more willing to install utility extensions.

Commercial implication:

- Do not fork the product model for Edge initially.
- Use the same entitlement backend if possible.
- Keep store assets provider-neutral enough to reuse.

### Firefox Add-ons

Firefox users can be privacy-sensitive, which fits the local-first story. However, Firefox extension APIs and Manifest V3 support can differ from Chrome, so Firefox should come after the paid model is validated on Chrome.

Commercial implication:

- Treat Firefox as a privacy-channel expansion, not the first monetization bet.
- Confirm provider injection and storage APIs before committing marketing spend.

### Safari Web Extensions

Safari can eventually matter for iCloud Photos positioning, but it introduces App Store packaging, Apple developer account, and platform-review complexity. It should not block the first paid Chrome launch.

Commercial implication:

- Defer until iCloud support is stable.
- Consider a separate Mac helper or Safari package only if there is clear iCloud demand.

## Payment Provider Comparison

ExtensionPay is convenient, but it is not the only low-friction option. Its 5% fee sits on top of Stripe processing, which makes it expensive once the product has even modest revenue. A direct Stripe setup has the best fee profile, while merchant-of-record providers can be better if global tax handling is more important than maximum margin.

| Option | Best for | Pros | Cons | Recommendation |
| --- | --- | --- | --- | --- |
| Stripe Checkout + custom license API | Lowest fees and long-term control | Full control, custom Cleanup Pass, signed entitlements, easy future dashboard | Requires webhook, database, and license API | **Best long-term default** |
| Polar | Merchant-of-record with developer-friendly APIs | Handles sales tax/VAT as MoR, modern checkout, subscriptions, digital products | Younger platform, integration still custom | **Best MoR candidate to evaluate** |
| Lemon Squeezy | Merchant-of-record simplicity | Handles tax/VAT, license-key style flows, established indie software use | Integration still custom inside extension, higher fee than Stripe direct | Good if tax handling is priority |
| Paddle | Merchant-of-record SaaS billing | Strong global tax handling and mature SaaS billing | Heavier setup, often better for SaaS than simple extension unlock | Consider after traction |
| ExtensionPay | Fast extension-specific monetization | Built for extensions, supports one-time/subscription/trial flows, less backend work | 5% fee on top of Stripe, less control, dependency risk | Useful only for fastest validation |
| Gumroad | Fastest manual product sale | Simple product sale, low engineering | Higher fee, weaker in-extension entitlement UX | Acceptable for a manual prelaunch only |

Approximate fee comparison for a $29 Lifetime Pro purchase:

| Option | Approximate fee | Approximate net | Notes |
| --- | ---: | ---: | --- |
| Stripe direct | $1.14 | $27.86 | Uses 2.9% + $0.30 US card pricing; tax handling is separate |
| ExtensionPay + Stripe | $2.59 | $26.41 | ExtensionPay 5% plus Stripe processing |
| Polar | $1.95 | $27.05 | Based on 5% + $0.50 MoR pricing |
| Lemon Squeezy | $1.95 | $27.05 | Based on 5% + $0.50 MoR pricing |
| Gumroad | $3.40 | $25.60 | Based on 10% + $0.50 pricing |

Approximate fee comparison for a $9 Cleanup Pass:

| Option | Approximate fee | Approximate net | Notes |
| --- | ---: | ---: | --- |
| Stripe direct | $0.56 | $8.44 | Best margin |
| ExtensionPay + Stripe | $1.01 | $7.99 | Similar to MoR options at low price, but without MoR benefits |
| Polar | $0.95 | $8.05 | MoR tax handling included |
| Lemon Squeezy | $0.95 | $8.05 | MoR tax handling included |
| Gumroad | $1.40 | $7.60 | Highest fee among these options |

Recommended sequence if engineering time is available:

1. Use **Stripe Checkout + a small license API**.
2. Use signed entitlement tokens in the extension.
3. Add Stripe Tax or a merchant-of-record provider later if tax obligations become the bottleneck.

Recommended sequence if tax/remittance simplicity matters more than fee minimization:

1. Evaluate **Polar** and **Lemon Squeezy** first.
2. Pick the one with the cleanest license-key/API workflow for extension entitlements.
3. Keep ExtensionPay as a fallback only if extension-specific convenience beats the fee/control tradeoff.

Recommended sequence if the goal is a very fast smoke test:

1. Sell a small number of manual lifetime licenses through Gumroad, Lemon Squeezy, or Stripe Payment Links.
2. Manually issue license keys.
3. Do not scale this path beyond early validation.

Best recommendation for PhotoSweep:

> Build Stripe Checkout plus a minimal license API unless speed is the only priority. If global tax handling is a blocker, evaluate Polar before ExtensionPay because Polar provides merchant-of-record benefits while landing near the same effective fee range as ExtensionPay for low-priced purchases.

Minimum custom Stripe stack:

- Stripe Checkout for `cleanup_pass`, `pro_lifetime`, and future `pro_annual`.
- Stripe webhooks for checkout completion, refund, dispute, and subscription changes.
- `licenses` table keyed by Stripe customer/session.
- License recovery endpoint by email.
- Entitlement endpoint returning signed tokens.
- Extension-side public-key verification.

This is more work than ExtensionPay, but it avoids the extra 5% extension tax and avoids coupling the product's licensing model to a third-party extension-specific vendor.

## Landing Page Research Implications

The landing page must reduce fear before asking for payment.

Above the fold:

- Say "duplicate photos" and "Google Photos" for search relevance.
- Say "without uploading your library" for trust.
- Say "review before Trash" for safety.
- Show the product UI, not abstract illustrations.

Recommended first viewport:

Headline:

> Clean up duplicate photos without uploading your library.

Subheadline:

> PhotoSweep finds duplicate and similar photos in Google Photos from your browser, then lets you review every group before anything moves to Trash.

Primary CTA:

> Install Free

Secondary CTA:

> Watch Safety Demo

Trust strip:

- Local-first analysis
- Review before Trash
- Export reports
- Not affiliated with Google

The landing page should not lead with "AI." In this category, "AI" can increase user concern that photos are being uploaded or interpreted remotely. If the word is used, qualify it:

> Local image matching runs in your browser.

## Search and Content Research

The highest-intent SEO cluster is not generic "photo cleaner." It is provider-specific:

- Google Photos duplicate finder
- Google Photos duplicate remover
- Remove duplicate photos from Google Photos
- Clean up Google Photos storage
- Google Photos storage full
- Find similar photos in Google Photos

Recommended content order:

1. `/google-photos-duplicate-finder`
2. `/google-photos-storage-cleanup`
3. `/remove-duplicate-photos-google-photos`
4. `/private-duplicate-photo-cleaner`
5. `/icloud-photos-duplicate-finder` only after iCloud support is stable
6. `/amazon-photos-duplicate-finder` only after Amazon support is stable

Each page should include:

- A warning to review before deleting.
- A restore-from-Trash section.
- A privacy section.
- A compatibility/limitations section.
- A CTA to install the free extension.

Avoid pages that imply official Google affiliation or guaranteed automatic deletion.

## Upgrade Experiment Design

Run the first paid experiment with three upgrade triggers:

### Trigger 1: Scan Cap

When free users hit the photo scan limit:

> You scanned 1,000 photos. Unlock Pro to continue this scan and review the rest of this library.

Best for:

- Users with large libraries.

Risk:

- If shown too early, it feels like a hard paywall before enough value is visible.

Mitigation:

- Show duplicate count and estimated recoverable storage from the free portion first.

### Trigger 2: Locked Duplicate Groups

When free users reach the visible group limit:

> PhotoSweep found more duplicate groups than the free review limit.

Best for:

- Users who already saw useful matches.

Risk:

- Locked content can feel frustrating if the free limit is too low.

Mitigation:

- Let users review enough groups to trust accuracy.

### Trigger 3: Bulk Trash

When free users try to move more than the free Trash cap:

> Free cleanup can move 10 confirmed items to Trash. Unlock Pro to move all reviewed duplicates in this session.

Best for:

- Users who already completed review and are ready to act.

Risk:

- Can feel like ransom if the user already invested too much work.

Mitigation:

- Allow a limited free cleanup and never block reports or restore guidance.

Recommended first experiment:

- Use Trigger 2 as the primary conversion point.
- Keep Trigger 1 soft.
- Use Trigger 3 as a secondary reminder, not the only paywall.

## Entitlement Abuse Cases

Plan for common abuse and failure cases without adding hostile DRM.

| Case | Expected behavior |
| --- | --- |
| User edits Chrome storage | Signed token verification fails; extension returns to free limits |
| User copies token to another browser profile | Allow if no device limit initially; add device limit later only if abuse is meaningful |
| User refunds purchase | License server returns inactive entitlement on next refresh |
| User is offline with valid lifetime license | Allow during grace period |
| User is offline with expired Cleanup Pass | Keep safety/report access, block new paid-scale actions |
| License server is down | Use cached entitlement during grace period |
| Payment provider webhook delayed | Show pending state and retry |
| User reinstalls extension | License recovery by email or payment-provider customer portal |
| User patches extension code | Out of scope for client-side DRM; monetize official builds and updates |

Do not add strict device limits at launch. Device limits create support friction and are easy to get wrong. Add them only if there is measurable sharing abuse.

## Security and Privacy Threat Model

The monetization layer creates new data flows. Keep them isolated from photo processing.

Threats:

- License API accidentally receives photo metadata.
- Analytics events include photo URLs or album names.
- Support exports include sensitive thumbnails or page data.
- Payment email becomes linkable to photo-library activity.
- Remote-code policy violation from payment SDK loading.
- Entitlement API leaks customer status.

Mitigations:

- Define a strict license API schema with no photo fields.
- Add tests or lint checks around analytics event payloads.
- Use bucketed counts for telemetry.
- Keep support bundles user-initiated and redacted by default.
- Do not load remote executable code in extension pages.
- Use rate limiting and generic errors for license lookup endpoints.
- Hash customer identifiers in extension-local state where possible.

Recommended internal rule:

> No photo content, photo URL, album name, filename, person label, location, or exact timestamp should ever be sent to analytics or licensing endpoints.

## Copy Blocks

### Privacy Copy

> PhotoSweep analyzes duplicate candidates locally in your browser. Payment and license checks are separate and do not include photo content.

### Safety Copy

> PhotoSweep never needs to permanently delete photos. It helps you review duplicate groups and move confirmed items to Trash, where supported providers allow restore for a limited time.

### Upgrade Copy

> Unlock larger cleanups, complete reports, and bulk actions. Your photo analysis still runs locally in your browser.

### Refund Copy

> If PhotoSweep cannot scan a supported library on your device, contact support within 7 days for a refund.

### Unofficial Product Copy

> PhotoSweep is an independent tool and is not affiliated with Google, Apple, Amazon, or their photo services.

## Recommended Gating Strategy

Gate scale and convenience, not safety.

### Free Tier

Recommended limits:

- Scan up to 1,000 photos per scan.
- Review up to 25 duplicate groups.
- Move up to 10 confirmed items to Trash.
- Export reports for free-visible groups.
- Show estimated total duplicate count and recoverable storage.

Free users should experience:

- The scan setup.
- The local-first trust promise.
- The duplicate grouping quality.
- The review workflow.
- The Trash safety flow on a small scale.

### Paid Tier

Unlock:

- Unlimited scan size.
- Full-library scans.
- Unlimited duplicate groups.
- Bulk Trash.
- Checkpoint/resume for large libraries.
- Advanced keep strategy.
- Similar-photo sensitivity controls.
- Complete CSV/JSON reports.
- iCloud Photos support when stable.
- Amazon Photos support when stable.
- Priority diagnostics/support.

### Never Gate

Do not gate:

- Safety warnings.
- Typed confirmation.
- Trash result reports.
- Restore instructions.
- Cache/privacy controls.
- Bug diagnostics.
- Access to reports after a Trash action has already started.

Rationale:

Paywalls should never make a risky action feel trapped. The user should not need to pay to understand what happened to their photos or how to restore them.

## Paywall Placement

Best moment:

> After a scan finds meaningful duplicate candidates, before full review or bulk cleanup.

Good flow:

1. User installs extension.
2. User runs a small scan.
3. App shows duplicate count and estimated recoverable storage.
4. User reviews free results.
5. User hits a scale limit.
6. Paywall offers Cleanup Pass or Lifetime Pro.

Bad flow:

1. User installs extension.
2. User sees paywall before scanning.

Why bad:

- No proof.
- Low trust.
- Users may think the product is a scam or unsafe.

### Paywall Copy

Headline:

> PhotoSweep found more duplicates than the free cleanup limit.

Body:

> Unlock Pro to review the full scan, export complete reports, and clean larger libraries. Photo analysis stays local in your browser.

Buttons:

- Unlock Lifetime Pro
- Get 7-Day Cleanup Pass
- Continue With Free Results

## Bypass Risk

### Can Users Bypass Paid Gates?

Yes. If premium behavior runs client-side in a browser extension, determined technical users can bypass it.

Assume:

- Shipped JavaScript can be inspected.
- Local storage can be edited.
- Feature checks can be patched.
- Network calls can be stubbed.
- Open-source code can be forked.
- Obfuscation only slows casual users.

This is especially true if the repository remains MIT licensed. MIT allows use, copy, modification, publication, sublicense, and sale, as long as the license notice is preserved.

### Realistic Goal

The goal is not unbreakable DRM.

The goal is:

- Stop casual bypass.
- Avoid accidental unlocks.
- Make honest payment simple.
- Preserve privacy.
- Monetize support, signed releases, updates, and maintenance.

Users who patch extension code are unlikely to be high-quality buyers. Over-investing in DRM will hurt honest users and the privacy promise.

## Recommended Entitlement Architecture

### Option 1: ExtensionPay

Best for:

- Fast launch.
- Minimal backend.
- One-time, recurring, and trial plans.
- Multi-browser future.

Tradeoffs:

- 5% ExtensionPay fee on top of Stripe processing.
- Less control over license model.
- Dependency on a third-party extension payment layer.

Use when:

- Speed matters more than custom licensing.
- You want to validate willingness to pay quickly.

### Option 2: Stripe Checkout + License API

Best for:

- More control.
- Custom cleanup pass.
- Custom license recovery.
- Signed entitlements.
- Future web dashboard.

Tradeoffs:

- More engineering.
- Need a backend/database.
- Need webhook handling.
- Need tax/refund/support operations.

Use when:

- You want stronger control from the start.
- You expect meaningful revenue or multiple products.

### Recommended First Implementation

Use ExtensionPay for the first paid test unless there is already a backend you want to own.

If building custom, use Stripe Checkout with:

- `customers`
- `checkout.sessions`
- `webhooks`
- `licenses` table
- `devices` table if device limits are needed
- signed entitlement tokens
- license recovery endpoint

## Signed Entitlement Design

Do not store `isPro: true` as the source of truth.

Store a signed token:

```ts
type EntitlementPlan =
  | "free"
  | "cleanup_pass"
  | "pro_lifetime"
  | "pro_annual"
  | "family_lifetime"

type SignedEntitlement = {
  version: 1
  subject: string
  plan: EntitlementPlan
  status: "active"
  issuedAt: string
  expiresAt?: string
  refreshAfter: string
  features: string[]
  customerHash: string
  signature: string
}
```

Recommended signing:

- Backend signs entitlement payload.
- Extension verifies signature using a bundled public key.
- Backend keeps the private key.
- Use Ed25519 or another modern asymmetric signature scheme.

The extension can verify:

- Signature is valid.
- Token is not expired.
- Plan includes feature.
- Token is within offline grace period.

The extension cannot prevent:

- A patched build skipping verification.
- A fork removing feature checks.

That limitation is acceptable.

## Centralized Feature Checks

Create a single entitlement module rather than scattering payment checks through UI components.

Example shape:

```ts
type Feature =
  | "scan:large"
  | "scan:full-library"
  | "review:unlimited-groups"
  | "trash:bulk"
  | "export:complete"
  | "resume:large-library"
  | "provider:icloud"
  | "provider:amazon"
  | "settings:advanced-similarity"
  | "settings:smart-keep"

type LimitName =
  | "maxPhotosPerScan"
  | "maxVisibleGroups"
  | "maxTrashItems"

const FREE_LIMITS = {
  maxPhotosPerScan: 1000,
  maxVisibleGroups: 25,
  maxTrashItems: 10
} as const
```

Recommended API:

```ts
function hasFeature(entitlement: EntitlementState, feature: Feature): boolean
function getLimit(entitlement: EntitlementState, limit: LimitName): number
function explainGate(feature: Feature): GateMessage
```

Use this module in:

- Scan config.
- Scan runner.
- Review UI.
- Export workflow.
- Trash workflow.
- Provider selection.

Do not rely on UI-only gates. Enforce limits at the action layer too.

## Where to Enforce Gates

### Scan Config

Free:

- Permit album/date scoped scans.
- Warn if scope is estimated to exceed free photo limit.
- Cap scan after limit if needed.

Paid:

- Full-library scan.
- Large scopes.
- More scan modes.

### Scan Runner

Free:

- Stop after `maxPhotosPerScan`.
- Preserve partial results.
- Show upgrade CTA with estimated unscanned remainder if known.

Paid:

- Continue through full scope.

### Review UI

Free:

- Show first `maxVisibleGroups`.
- Lock remaining groups.
- Do not blur personal photo thumbnails if avoidable; use a neutral locked row instead.

Paid:

- Full review.

### Trash Action

Free:

- Allow small proof action, e.g. 10 items.
- Require same safety confirmations as paid.

Paid:

- Bulk Trash for reviewed candidates.

### Export

Free:

- Export visible/free groups.

Paid:

- Export complete scan.

## Offline and Failure Behavior

Entitlement failures should be conservative but not hostile.

Recommended:

- Cache signed entitlement locally.
- Refresh periodically.
- For lifetime licenses, use a long refresh window.
- For cleanup pass and annual licenses, use a shorter refresh window.
- Allow a grace period if the license server is unavailable.
- Never block access to safety reports or restore guidance because of license refresh failure.

Example:

| Plan | Refresh | Offline grace |
| --- | --- | --- |
| Cleanup Pass | Every launch or every 12 hours | Until `expiresAt`, plus 24 hours |
| Annual Pro | Every 3-7 days | 14 days |
| Lifetime Pro | Every 30-90 days | 90 days |

## Open Source and Licensing Implications

The repo currently uses MIT, and the bundled Google Photos Toolkit is also MIT.

Implications:

- Selling the extension is allowed.
- Forking and modifying the extension is allowed.
- Removing paywall checks in a fork is allowed under MIT if notices remain intact.
- A closed-source commercial fork would also be allowed under MIT.

Options:

### Keep MIT

Pros:

- Trust and transparency.
- Easier community contributions.
- Consistent with current upstream dependency.

Cons:

- Easy paywall removal.
- Fork competition is possible.

Best business model if keeping MIT:

- Charge for official signed builds, auto-updates, support, documentation, and maintenance.

### Dual License Future Code

Pros:

- More control over future commercial distribution.

Cons:

- Harder with existing MIT history.
- Does not remove users' rights to already-published MIT versions.
- May reduce trust.

Recommendation:

Keep MIT for now. Do not over-optimize for anti-fork protection before proving paid demand.

## Privacy Policy Requirements

The privacy policy should state:

- What photo-related data is processed locally.
- What photo-related data is stored locally.
- Whether photo content, thumbnails, URLs, filenames, metadata, or embeddings are sent anywhere.
- What payment/license data is sent to payment providers and license servers.
- What analytics are collected, if any.
- How users can clear local cache.
- How users can request license/account deletion.
- Whether support diagnostics include user-controlled exports only.

Recommended privacy claim:

> PhotoSweep does not upload your photo content for duplicate analysis. Duplicate matching runs locally in your browser. Payment and license checks may contact our payment provider or license server, but those checks do not require sending your photos.

Avoid:

- "We collect no data" if the product stores local caches or checks licenses.
- "100% private" unless every data path has been audited.
- "No data leaves your browser" once payment/licensing is added, unless carefully qualified.

Better:

> Photo analysis stays local. License checks are separate and do not include photo content.

## Chrome Web Store Listing Guidance

### Single Purpose

Use a clear single-purpose statement:

> PhotoSweep helps users find duplicate and similar photos in supported cloud photo libraries and move reviewed duplicates to Trash.

### Permissions Explanation

For the current manifest, explain:

- `activeTab`: interact with the current supported photo-library tab after user action.
- `tabs`: open and manage extension workflow tabs.
- `scripting`: inject provider bridge scripts required to read and act on supported photo-library pages.
- `webNavigation`: detect supported provider page navigation and lifecycle.
- `storage` / `unlimitedStorage`: store local scan checkpoints, metadata snapshots, and embeddings for large-library scans.
- Host permissions: limit to supported photo providers and image asset domains needed for analysis.

If possible, narrow host permissions over time. Chrome policy expects the narrowest permissions necessary for current features.

### Store Description

Use:

> PhotoSweep helps you find duplicate and similar photos in Google Photos without uploading your library to another service.

Avoid:

> Automatically delete all duplicates.

Use:

> Move confirmed duplicates to Trash after review.

Avoid:

> Official Google Photos cleaner.

Use:

> PhotoSweep is not affiliated with Google.

## Analytics Guidance

Track only product events needed to improve conversion and reliability.

Acceptable low-risk events:

- Extension opened.
- Scan started.
- Scan completed.
- Scan failed with error code.
- Duplicate groups found bucketed into ranges.
- Estimated recoverable storage bucketed into ranges.
- Upgrade screen viewed.
- Upgrade clicked.
- Purchase completed.
- Report exported.
- Trash action completed count bucketed into ranges.

Avoid:

- Photo URLs.
- Photo thumbnails.
- Exact filenames.
- Exact timestamps.
- Location metadata.
- People/faces.
- Album names unless explicitly user-shared for support.
- Raw page content.

Use bucketed values:

- `groups_found_bucket: "1-10" | "11-50" | "51-200" | "200+"`
- `storage_recoverable_bucket: "<1GB" | "1-5GB" | "5-20GB" | "20GB+"`

## Support and Trust

Trust assets to publish before charging:

- Privacy policy.
- Safety model.
- Restore guide.
- Known limitations.
- Provider compatibility page.
- Changelog.
- Support email.
- Demo video.
- Sample report.
- Refund policy.

Refund recommendation:

- 7-day refund window for lifetime purchases.
- No-questions refund if the extension cannot scan a supported provider.
- Cleanup Pass refund if the product fails before user can review results.

This reduces purchase anxiety and supports the safety-first brand.

## Launch Plan

### Phase 1: Brand and Trust

Ship:

- PhotoSweep name and landing page.
- Privacy policy.
- Safety model.
- Demo.
- Chrome Web Store listing draft.
- Provider compatibility page.

Do not ship payment yet if the safety story is incomplete.

### Phase 2: Free Value Proof

Ship:

- Free scan cap.
- Estimated duplicate count.
- Estimated recoverable storage.
- Locked rows beyond free review limit.
- Upgrade screen without payment, or with waitlist/email capture if payment is not ready.

Goal:

- Prove conversion intent before building full licensing.

### Phase 3: Paid Unlock

Ship:

- ExtensionPay or Stripe Checkout.
- Signed entitlement cache.
- Cleanup Pass.
- Lifetime Pro.
- License recovery.
- Refund policy.

Goal:

- Start charging only after the app can show value first.

### Phase 4: Multi-Provider Expansion

Ship:

- iCloud Photos Pro support when stable.
- Amazon Photos Pro support when stable.
- Provider-specific landing pages.
- Annual Pro if maintenance burden is clear.

## Suggested Feature Matrix

| Feature | Free | Cleanup Pass | Lifetime Pro |
| --- | --- | --- | --- |
| Local duplicate scan | Limited | Unlimited during pass | Unlimited |
| Scan cap | 1,000 photos | Unlimited | Unlimited |
| Duplicate groups | 25 groups | Unlimited | Unlimited |
| Full-library scan | No | Yes | Yes |
| Review UI | Limited | Full | Full |
| Bulk Trash | 10 items | Full | Full |
| Safety confirmations | Yes | Yes | Yes |
| Result reports | Yes | Yes | Yes |
| Complete CSV/JSON export | Limited | Yes | Yes |
| Checkpoint/resume | Limited | Yes | Yes |
| Advanced keep rules | No | Yes | Yes |
| Similarity controls | No | Yes | Yes |
| iCloud/Amazon providers | No or preview | Yes during pass | Yes |
| Priority support | No | During pass | Yes |

## Implementation Backlog

### Product

- Add plan constants and feature matrix.
- Add scan size estimates before scan start.
- Add free limits to scan config.
- Add locked duplicate-group rows after free limit.
- Add upgrade modal.
- Add storage estimate display.
- Add plan/status UI.
- Add restore-license UI.

### Licensing

- Choose ExtensionPay or custom Stripe.
- Add entitlement service.
- Add local signed entitlement cache.
- Add action-layer gate checks.
- Add offline grace logic.
- Add test fixtures for free, expired, pass, annual, lifetime.

### Privacy and Policy

- Draft privacy policy.
- Draft permission explanations.
- Draft data-use disclosure.
- Audit host permissions.
- Audit build output for remote hosted code risk.
- Add support and refund pages.

### QA

- Test free scan limit.
- Test locked review groups.
- Test paid unlock after scan.
- Test entitlement refresh failure.
- Test expired Cleanup Pass.
- Test offline lifetime entitlement.
- Test that safety reports remain visible without active entitlement.
- Test that UI-only unlocks do not bypass action-layer limits.

### Research Validation

- Search Chrome Web Store for active duplicate-photo extensions and note their messaging.
- Search Product Hunt/Reddit for user complaints about duplicate photo cleaners.
- Test 2-3 landing-page headlines with paid search or organic waitlist traffic.
- Ask 10 beta users whether they prefer Cleanup Pass, Lifetime, or Annual.
- Ask beta users what they are afraid might go wrong before they click Trash.
- Measure whether "local-first" or "no upload" drives more install clicks.
- Measure whether storage-savings estimates increase upgrade conversion.
- Run a refund reason review after the first 20 purchases.

## 30-Day Research and Launch Plan

### Week 1: Policy and Trust

- Finalize privacy policy.
- Finalize permission explanations.
- Audit remote hosted code risk.
- Draft Chrome Web Store listing.
- Draft landing page copy.

### Week 2: Gating Prototype

- Implement free limits behind local feature flags.
- Add locked group UI.
- Add upgrade screen without payment.
- Add telemetry for upgrade screen views and clicks with bucketed data only.

### Week 3: Payment Validation

- Add ExtensionPay or Stripe test mode.
- Add entitlement cache.
- Add license recovery.
- Add expired/pass/lifetime test fixtures.
- Run end-to-end tests for free and paid flows.

### Week 4: Beta and Pricing Test

- Invite beta users.
- Offer $9 Cleanup Pass and $29 Lifetime.
- Collect support/refund issues.
- Tune free limits based on trust and conversion.
- Decide whether to ship paid publicly or extend beta.

## Decision Matrix

| Decision | Recommended default | Change if |
| --- | --- | --- |
| Brand | PhotoSweep | Trademark/domain conflict appears |
| First market | Chrome + Google Photos | iCloud proves stronger in beta |
| Payment provider | ExtensionPay | Existing backend makes Stripe cheap |
| Primary price | $29 Lifetime | Conversion strong enough to test $39 |
| Secondary price | $9 Cleanup Pass | Most users reject lifetime |
| Subscription | Defer | Users return monthly or provider maintenance is heavy |
| Source license | Keep MIT | There is a deliberate business shift toward proprietary releases |
| Device limits | None at launch | License sharing becomes measurable |
| Analytics | Bucketed product events only | Privacy policy and user consent support more, which is unlikely to be worth it |

## Key Product Decisions

1. Charge after value is visible, not before.
2. Gate scale, not safety.
3. Preserve local-first analysis.
4. Treat bypass prevention as friction, not unbreakable DRM.
5. Avoid ads, affiliates, and data monetization.
6. Keep naming provider-neutral while SEO targets Google Photos first.
7. Keep pricing consumer-friendly and anchored against storage subscriptions.

## Source Notes

- Chrome Web Store payments deprecation: https://developer.chrome.com/docs/webstore/cws-payments-deprecation
- Chrome Web Store Program Policies: https://developer.chrome.com/docs/webstore/program-policies/policies
- Chrome Web Store user data FAQ: https://developer.chrome.com/docs/webstore/program-policies/user-data-faq
- Chrome remote hosted code guidance: https://developer.chrome.com/docs/extensions/develop/migrate/remote-hosted-code
- Chrome Web Store publish guide and disclosure context: https://developer.chrome.com/docs/webstore/publish
- Microsoft Edge Add-ons policies: https://learn.microsoft.com/en-us/microsoft-edge/extensions-chromium/store-policies/developer-policies
- Mozilla Add-ons policies: https://extensionworkshop.com/documentation/publish/add-on-policies/
- Google One pricing: https://one.google.com/about/plans
- ExtensionPay payment model: https://extensionpay.com/
- Stripe pricing: https://stripe.com/pricing
- Polar pricing: https://polar.sh/resources/pricing
- Lemon Squeezy pricing: https://www.lemonsqueezy.com/pricing
- Paddle pricing: https://www.paddle.com/pricing
- Gumroad pricing: https://gumroad.com/pricing
- PhotoSweeper App Store price reference: https://apps.apple.com/us/app/photosweeper/id463362050
- Duplicate Photos Fixer Pro pricing reference: https://www.duplicatephotosfixer.com/price-pc/
