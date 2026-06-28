// MAIN world command handler for iCloud Photos pages.

const GPD_APP_ID = "GPD"

function postResult(command, requestId, data) {
  window.postMessage(
    {
      app: GPD_APP_ID,
      action: "gptkResult",
      command,
      requestId,
      success: true,
      data
    },
    "*"
  )
}

function postError(command, requestId, error) {
  window.postMessage(
    {
      app: GPD_APP_ID,
      action: "gptkResult",
      command,
      requestId,
      success: false,
      error: error instanceof Error ? error.message : String(error)
    },
    "*"
  )
}

function postProgress(requestId, itemsProcessed, message) {
  window.postMessage(
    {
      app: GPD_APP_ID,
      action: "gptkProgress",
      requestId,
      itemsProcessed,
      message
    },
    "*"
  )
}

function hashString(value) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

function bestImageSource(image) {
  const current = image.currentSrc || image.src
  if (current) return current
  const srcset = image.getAttribute("srcset")
  if (!srcset) return ""
  return (
    srcset
      .split(",")
      .map((entry) => entry.trim().split(/\s+/)[0])
      .filter(Boolean)
      .pop() || ""
  )
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function allElements(root = document) {
  const result = []
  const visit = (node) => {
    if (!node) return
    if (node.nodeType === Node.ELEMENT_NODE) {
      result.push(node)
      if (node.shadowRoot) visit(node.shadowRoot)
      if (node.tagName === "IFRAME") {
        try {
          if (node.contentDocument?.documentElement) {
            visit(node.contentDocument.documentElement)
          }
        } catch {
          // Cross-origin iframes are not inspectable; same-origin iCloud app
          // frames are traversed so the photo grid can be scanned.
        }
      }
    }
    const children = node.children || []
    for (const child of children) visit(child)
  }
  visit(root.documentElement || root)
  return result
}

function cssUrl(value) {
  const match = /url\((['"]?)(.*?)\1\)/.exec(value || "")
  return match?.[2] || ""
}

function mediaCandidates() {
  const elements = allElements()
  const candidates = []
  for (const element of elements) {
    if (element.tagName === "IMG") {
      const source = bestImageSource(element)
      if (source) {
        candidates.push({
          element,
          source,
          width: element.naturalWidth || element.width,
          height: element.naturalHeight || element.height
        })
      }
      continue
    }

    const style =
      element.ownerDocument?.defaultView?.getComputedStyle(element) ??
      getComputedStyle(element)
    const source = cssUrl(style.backgroundImage)
    if (!source) continue
    const rect = element.getBoundingClientRect()
    candidates.push({
      element,
      source,
      width: rect.width,
      height: rect.height
    })
  }

  return candidates.filter((candidate) => {
    if (!candidate.source) return false
    if (/^data:image\/svg/i.test(candidate.source)) return false
    return candidate.width >= 40 && candidate.height >= 40
  })
}

async function waitForMediaCandidates(requestId) {
  for (let attempt = 0; attempt < 12; attempt++) {
    const candidates = mediaCandidates()
    if (candidates.length > 0) return candidates
    postProgress(
      requestId,
      0,
      attempt === 0
        ? "Waiting for iCloud Photos thumbnails..."
        : "Still waiting for loaded iCloud Photos thumbnails..."
    )
    await sleep(500)
  }
  return mediaCandidates()
}

function nearbyLabel(element) {
  const labelledBy = element.getAttribute("aria-labelledby")
  if (labelledBy) {
    const label = document.getElementById(labelledBy)
    if (label?.textContent?.trim()) return label.textContent.trim()
  }
  const direct =
    element.getAttribute("aria-label") ||
    element.getAttribute("alt") ||
    element.getAttribute("title")
  if (direct) return direct.trim()
  const parentText = element
    .closest("[aria-label], [title]")
    ?.getAttribute("aria-label")
  return parentText?.trim() || ""
}

function parseTimestamp(label) {
  const parsed = Date.parse(label)
  return Number.isFinite(parsed) ? parsed : Date.now()
}

function assertSupportedRoute() {
  const route = location.href.toLowerCase()
  if (route.includes("recentlydeleted")) {
    throw new Error(
      "iCloud scan is disabled while Recently Deleted is open. Open iCloud Photos Library or Recents, then scan again."
    )
  }
  if (route.includes("/hidden") || route.includes("#/hidden")) {
    throw new Error(
      "iCloud scan is disabled while Hidden is open. Open iCloud Photos Library or Recents, then scan again."
    )
  }
}

async function blobUrlToDataUrl(url, element = document.documentElement) {
  if (!url.startsWith("blob:")) return url
  const ownerWindow = element.ownerDocument?.defaultView ?? window
  try {
    const response = await ownerWindow.fetch(url)
    const blob = await response.blob()
    return await new Promise((resolve, reject) => {
      const reader = new ownerWindow.FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(reader.error || new Error("Read failed"))
      reader.readAsDataURL(blob)
    })
  } catch (error) {
    if (element.tagName !== "IMG") throw error
    const canvas = element.ownerDocument.createElement("canvas")
    canvas.width = element.naturalWidth || Math.round(element.width)
    canvas.height = element.naturalHeight || Math.round(element.height)
    const context = canvas.getContext("2d")
    if (!context || canvas.width <= 0 || canvas.height <= 0) throw error
    context.drawImage(element, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL("image/jpeg", 0.85)
  }
}

async function mapCandidate(candidate, index) {
  const { element, source } = candidate
  if (!source) return null
  const label = nearbyLabel(element)
  const stable = `${source}|${label}|${index}`
  const mediaKey = `icloud-${hashString(stable)}`
  let thumb = source
  try {
    thumb = await blobUrlToDataUrl(source, element)
  } catch {
    thumb = source
  }

  return {
    mediaKey,
    dedupKey: mediaKey,
    thumb,
    provider: "icloud",
    productUrl: window.location.href,
    timestamp: parseTimestamp(label),
    creationTimestamp: Date.now(),
    resWidth: Math.round(candidate.width) || undefined,
    resHeight: Math.round(candidate.height) || undefined,
    fileName: label || `iCloud Photo ${index + 1}`,
    takesUpSpace: null,
    isOriginalQuality: null
  }
}

async function getAllMediaItems(requestId, args) {
  try {
    assertSupportedRoute()
    const candidates = await waitForMediaCandidates(requestId)
    const seen = new Set()
    const mediaItems = []
    for (let index = 0; index < candidates.length; index++) {
      const item = await mapCandidate(candidates[index], index)
      if (!item || seen.has(item.thumb)) continue
      seen.add(item.thumb)
      mediaItems.push(item)
      if (index % 25 === 0) {
        postProgress(
          requestId,
          mediaItems.length,
          `Collected ${mediaItems.length} loaded iCloud photos`
        )
      }
    }

    const from = args?.dateRange?.from
      ? Date.parse(`${args.dateRange.from}T00:00:00.000Z`)
      : Number.NEGATIVE_INFINITY
    const to = args?.dateRange?.to
      ? Date.parse(`${args.dateRange.to}T23:59:59.999Z`)
      : Number.POSITIVE_INFINITY
    const filtered = mediaItems.filter(
      (item) => item.timestamp >= from && item.timestamp <= to
    )
    postProgress(
      requestId,
      filtered.length,
      `Fetched ${filtered.length} loaded iCloud photos`
    )
    postResult("getAllMediaItems", requestId, filtered)
  } catch (error) {
    postError("getAllMediaItems", requestId, error)
  }
}

function healthCheck(requestId) {
  const onIcloudPhotos =
    location.hostname === "www.icloud.com" &&
    location.pathname.startsWith("/photos")
  postResult("healthCheck", requestId, {
    hasGptk: onIcloudPhotos,
    accountEmail: ""
  })
}

window.addEventListener("message", async (event) => {
  if (event.source !== window) return
  const msg = event.data
  if (msg?.app !== GPD_APP_ID || msg?.action !== "gptkCommand") return

  const { command, requestId, args } = msg
  switch (command) {
    case "getAllMediaItems":
      await getAllMediaItems(requestId, args)
      break
    case "listAlbums":
      postResult("listAlbums", requestId, [])
      break
    case "healthCheck":
      healthCheck(requestId)
      break
    default:
      postError(command, requestId, `Unsupported iCloud command: ${command}`)
  }
})

console.log("GPD: iCloud command handler loaded")
