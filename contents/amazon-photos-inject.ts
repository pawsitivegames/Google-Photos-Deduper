import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
  matches: ["https://www.amazon.ca/*"],
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

injectScript("scripts/amazon-photos-commands.js")

console.log("GPD: Injected MAIN world scripts into Amazon Photos page")
