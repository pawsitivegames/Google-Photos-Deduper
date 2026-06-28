import { APP_ID } from "../lib/types"
import type {
  AppMessage,
  GptkCommandMessage,
  GptkProgressMessage,
  GptkResultMessage,
  PhotoProvider
} from "../lib/types"

// Service worker for Google Photos Deduper.
// Routes messages between the app tab and the Google Photos tab.

// Bidirectional tab mapping: appTabId <-> gpTabId
const tabMap: Record<number, number> = {}
const tabProviderMap: Record<number, PhotoProvider> = {}

// Pending GPTK command callbacks, keyed by requestId
const pendingCommands: Record<
  string,
  {
    resolve: (data: unknown) => void
    reject: (error: string) => void
    appTabId: number | null
  }
> = {}

function providerTabPattern(provider: PhotoProvider = "google"): string {
  return provider === "icloud"
    ? "https://www.icloud.com/*"
    : "https://photos.google.com/*"
}

function providerName(provider: PhotoProvider = "google"): string {
  return provider === "icloud" ? "iCloud Photos" : "Google Photos"
}

function providerOpenUrl(provider: PhotoProvider = "google"): string {
  return provider === "icloud" ? "icloud.com/photos" : "photos.google.com"
}

function hasTabId(tab: Pick<chrome.tabs.Tab, "id">): tab is chrome.tabs.Tab & {
  id: number
} {
  return tab.id !== undefined && tab.id !== null
}

// ============================================================
// Find tabs
// ============================================================

/**
 * Find a Google Photos tab that the bridge content script can actually reach.
 *
 * When the user has multiple photos.google.com tabs open (e.g. opened before
 * the extension was installed, or duplicated via the "Open Google Photos"
 * button), picking the first one returned by chrome.tabs.query is unreliable:
 * the bridge may not be loaded in it, and chrome.tabs.sendMessage rejects with
 * "Receiving end does not exist", surfacing as a spurious "Cannot connect to
 * Google Photos" error.
 *
 * Strategy: prefer the active tab, then sort by lastAccessed descending, and
 * ping each one until we find a reachable bridge. The bridge ignores
 * unrecognized actions, so a no-op ping resolves with undefined when reachable
 * and rejects when no content script is present.
 */
async function findProviderTab(
  provider: PhotoProvider = "google"
): Promise<chrome.tabs.Tab | null> {
  const tabs = await chrome.tabs.query({ url: providerTabPattern(provider) })
  if (tabs.length === 0) return null

  // `lastAccessed` is available in Chrome 121+ but missing from this version
  // of @types/chrome.
  type TabWithLastAccessed = chrome.tabs.Tab & { lastAccessed?: number }
  const sorted = [...tabs].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1
    const aAccessed = (a as TabWithLastAccessed).lastAccessed ?? 0
    const bAccessed = (b as TabWithLastAccessed).lastAccessed ?? 0
    return bAccessed - aAccessed
  })

  for (const candidate of sorted) {
    if (!hasTabId(candidate)) continue
    try {
      await chrome.tabs.sendMessage(candidate.id, {
        app: APP_ID,
        action: "ping"
      })
      return candidate
    } catch {
      // Bridge not loaded in this tab; try the next one.
    }
  }
  return null
}

async function getReachableMappedProviderTabId(
  senderTabId: number,
  provider: PhotoProvider = "google"
): Promise<number | null> {
  const mappedTabId = tabMap[senderTabId]
  if (mappedTabId === undefined) return null
  if (mappedTabId === senderTabId) {
    delete tabMap[senderTabId]
    delete tabProviderMap[senderTabId]
    return null
  }
  if (tabProviderMap[senderTabId] !== provider) {
    delete tabMap[mappedTabId]
    delete tabMap[senderTabId]
    delete tabProviderMap[mappedTabId]
    delete tabProviderMap[senderTabId]
    return null
  }

  try {
    await chrome.tabs.sendMessage(mappedTabId, {
      app: APP_ID,
      action: "ping"
    })
    return mappedTabId
  } catch {
    delete tabMap[senderTabId]
    delete tabMap[mappedTabId]
    delete tabProviderMap[senderTabId]
    delete tabProviderMap[mappedTabId]
    return null
  }
}

/**
 * Get the sender's tab ID. For content scripts, sender.tab is set.
 * For extension pages (tabs/app.html), sender.tab is undefined —
 * we resolve it from sender.url via chrome.tabs.query.
 */
async function getSenderTabId(
  sender: chrome.runtime.MessageSender
): Promise<number | null> {
  if (sender.tab?.id !== undefined && sender.tab.id !== null) {
    return sender.tab.id
  }

  // Extension page: find tab by URL
  if (sender.url) {
    const tabs = await chrome.tabs.query({ url: sender.url })
    if (tabs.length > 0 && hasTabId(tabs[0])) return tabs[0].id
  }
  return null
}

// ============================================================
// Send a GPTK command to the Google Photos tab and await result
// ============================================================

function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function sendGptkCommand(
  gpTabId: number,
  command: string,
  args?: unknown,
  provider: PhotoProvider = "google"
): Promise<unknown> {
  const requestId = generateRequestId()

  const message: GptkCommandMessage = {
    app: APP_ID,
    action: "gptkCommand",
    command,
    requestId,
    args,
    provider
  }

  return new Promise((resolve, reject) => {
    pendingCommands[requestId] = { resolve, reject, appTabId: null }
    chrome.tabs.sendMessage(gpTabId, message).catch(() => {
      delete pendingCommands[requestId]
      reject(
        `Unable to connect to ${providerName(provider)} tab. Please reload the tab and try again.`
      )
    })
  })
}

// ============================================================
// Message handler
// ============================================================

chrome.runtime.onMessage.addListener(
  (message: AppMessage, sender: chrome.runtime.MessageSender) => {
    if (message?.app !== APP_ID) return

    switch (message.action) {
      case "launchApp":
        handleLaunchApp(sender)
        break
      case "healthCheck":
        handleHealthCheck(message, sender)
        break
      case "gptkCommand":
        handleGptkCommand(message as GptkCommandMessage, sender)
        break
      case "gptkResult":
        handleGptkResult(message as GptkResultMessage, sender)
        break
      case "gptkProgress":
        handleGptkProgress(message as GptkProgressMessage, sender)
        break
    }
  }
)

// ============================================================
// Handlers
// ============================================================

async function handleLaunchApp(
  sender: chrome.runtime.MessageSender
): Promise<void> {
  const appTab = await chrome.tabs.create({
    url: chrome.runtime.getURL("tabs/app.html")
  })
  if (
    sender.tab?.id !== undefined &&
    sender.tab.id !== null &&
    hasTabId(appTab)
  ) {
    tabMap[sender.tab.id] = appTab.id
    tabMap[appTab.id] = sender.tab.id
  }
}

async function handleHealthCheck(
  message: AppMessage,
  sender: chrome.runtime.MessageSender
): Promise<void> {
  const provider =
    message.action === "healthCheck" ? message.provider ?? "google" : "google"
  const senderTabId = await getSenderTabId(sender)

  const providerTab = await findProviderTab(provider)
  if (!providerTab || !hasTabId(providerTab)) {
    if (senderTabId !== null) {
      chrome.tabs.sendMessage(senderTabId, {
        app: APP_ID,
        action: "healthCheck.result",
        provider,
        success: false,
        hasGptk: false
      })
    }
    return
  }

  if (senderTabId !== null) {
    tabMap[senderTabId] = providerTab.id
    tabMap[providerTab.id] = senderTabId
    tabProviderMap[senderTabId] = provider
    tabProviderMap[providerTab.id] = provider
  }

  try {
    const result = await sendGptkCommand(
      providerTab.id,
      "healthCheck",
      undefined,
      provider
    )
    if (senderTabId !== null) {
      const r = result as { hasGptk: boolean; accountEmail?: string }
      chrome.tabs.sendMessage(senderTabId, {
        app: APP_ID,
        action: "healthCheck.result",
        provider,
        success: true,
        hasGptk: r.hasGptk,
        accountEmail: r.accountEmail
      })
    }
  } catch {
    if (senderTabId !== null) {
      chrome.tabs.sendMessage(senderTabId, {
        app: APP_ID,
        action: "healthCheck.result",
        provider,
        success: false,
        hasGptk: false
      })
    }
  }
}

async function handleGptkCommand(
  message: GptkCommandMessage,
  sender: chrome.runtime.MessageSender
): Promise<void> {
  const senderTabId = await getSenderTabId(sender)
  if (senderTabId === null) return
  const provider = message.provider ?? "google"

  let providerTabId = await getReachableMappedProviderTabId(
    senderTabId,
    provider
  )
  if (providerTabId === null) {
    const providerTab = await findProviderTab(provider)
    if (!providerTab || !hasTabId(providerTab)) {
      chrome.tabs.sendMessage(senderTabId, {
        app: APP_ID,
        action: "gptkResult",
        command: message.command,
        requestId: message.requestId,
        success: false,
        error: `${providerName(provider)} tab not found. Please open ${providerOpenUrl(provider)}.`
      } as GptkResultMessage)
      return
    }
    providerTabId = providerTab.id
    tabMap[senderTabId] = providerTabId
    tabMap[providerTabId] = senderTabId
    tabProviderMap[senderTabId] = provider
    tabProviderMap[providerTabId] = provider
  }

  pendingCommands[message.requestId] = {
    resolve: () => {},
    reject: () => {},
    appTabId: senderTabId
  }

  if (provider === "icloud" && message.command === "getAllMediaItems") {
    await chrome.tabs.update(providerTabId, { active: true }).catch(() => {})
    await sleep(1500)
  }

  chrome.tabs.sendMessage(providerTabId, message).catch(() => {
    chrome.tabs.sendMessage(senderTabId, {
      app: APP_ID,
      action: "gptkResult",
      command: message.command,
      requestId: message.requestId,
      success: false,
      error: `Unable to connect to ${providerName(provider)} tab. Please reload the tab and try again.`
    } as GptkResultMessage)
    delete pendingCommands[message.requestId]
  })
}

function handleGptkResult(
  message: GptkResultMessage,
  _sender: chrome.runtime.MessageSender
): void {
  const pending = pendingCommands[message.requestId]
  if (!pending) return

  // Relay result to the app tab
  if (pending.appTabId !== null) {
    chrome.tabs.sendMessage(pending.appTabId, message)
  }

  // Resolve/reject the promise if anyone is awaiting
  if (message.success) {
    pending.resolve(message.data)
  } else {
    pending.reject(message.error || "Unknown error")
  }

  delete pendingCommands[message.requestId]
}

function handleGptkProgress(
  message: GptkProgressMessage,
  _sender: chrome.runtime.MessageSender
): void {
  const pending = pendingCommands[message.requestId]
  if (!pending || pending.appTabId === null) return

  // Relay progress to the app tab
  chrome.tabs.sendMessage(pending.appTabId, message)
}

// ============================================================
// Tab cleanup
// ============================================================

chrome.tabs.onRemoved.addListener((tabId) => {
  const mappedTabId = tabMap[tabId]
  if (mappedTabId !== undefined) {
    delete tabMap[mappedTabId]
    delete tabProviderMap[mappedTabId]

    // If a GP tab closed, notify the app tab
    chrome.tabs
      .sendMessage(mappedTabId, {
        app: APP_ID,
        action: "gptkLog",
        level: "error",
        message: "Connected photo source tab was closed."
      })
      .catch(() => {
        // App tab may also be gone
      })
  }
  delete tabMap[tabId]
  delete tabProviderMap[tabId]

  // Clean up any pending commands from this tab
  for (const [reqId, cmd] of Object.entries(pendingCommands)) {
    if (cmd.appTabId === tabId) {
      delete pendingCommands[reqId]
    }
  }
})

// Open the app tab when the extension icon is clicked
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL("tabs/app.html") })
})

console.log("GPD: Service worker loaded")
