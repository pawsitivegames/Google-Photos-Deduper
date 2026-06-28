import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
  matches: ["https://www.icloud.com/*"],
  run_at: "document_idle"
}

function injectScript(fileName: string): void {
  const url = chrome.runtime.getURL(fileName)
  const script = document.createElement("script")
  script.src =
    url + "?v=" + chrome.runtime.getManifest().version + "-" + Date.now()
  script.type = "text/javascript"
  ;(document.head || document.documentElement).appendChild(script)
}

injectScript("scripts/icloud-photos-commands.js")

console.log("GPD: Injected MAIN world scripts into iCloud Photos page")
