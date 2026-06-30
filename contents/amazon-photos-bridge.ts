import type { PlasmoCSConfig } from "plasmo"

import { APP_ID } from "../lib/types"
import type { AppMessage } from "../lib/types"

export const config: PlasmoCSConfig = {
  matches: ["https://www.amazon.ca/*"],
  run_at: "document_idle"
}

window.addEventListener("message", (event) => {
  if (event.source !== window) return
  const msg = event.data as AppMessage
  if (msg?.app !== APP_ID) return

  if (
    msg.action === "gptkResult" ||
    msg.action === "gptkProgress" ||
    msg.action === "gptkLog"
  ) {
    chrome.runtime.sendMessage(msg)
  }
})

chrome.runtime.onMessage.addListener((message: AppMessage) => {
  if (message?.app !== APP_ID) return
  if (message.action === "gptkCommand") {
    window.postMessage(message)
  }
})

console.log("GPD: Amazon Photos bridge content script loaded")
