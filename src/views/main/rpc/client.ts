import { Electroview } from "electrobun/view"
import type { AppRPC } from "../../../shared/types"
import { applyEditorFont, applyTheme } from "../theme"

export const rpc = Electroview.defineRPC<AppRPC>({
  // A hung bun-side request must reject, not hang the UI forever. Generous
  // enough for large-workspace scans; bun-side handlers cap at 10s anyway.
  maxRequestTime: 30_000,
  handlers: {
    requests: {},
    messages: {
      themeChanged: ({ theme }) => {
        applyTheme(theme)
      },
      toggleQuickOpen: () => {
        window.dispatchEvent(new CustomEvent("quincy:toggleQuickOpen"))
      },
      exportHtml: () => {
        window.dispatchEvent(new CustomEvent("quincy:exportHtml"))
      },
      showSettings: () => {
        window.dispatchEvent(new CustomEvent("quincy:showSettings"))
      },
      workspaceFoldersChanged: ({ folders }) => {
        window.dispatchEvent(
          new CustomEvent("quincy:workspaceFoldersChanged", { detail: folders }),
        )
      },
      closeFile: () => {
        window.dispatchEvent(new CustomEvent("quincy:closeFile"))
      },
      newFile: () => {
        window.dispatchEvent(new CustomEvent("quincy:newFile"))
      },
      openFile: ({ path }) => {
        window.dispatchEvent(new CustomEvent("quincy:openFile", { detail: path }))
      },
      find: () => {
        window.dispatchEvent(new CustomEvent("quincy:find"))
      },
      reload: () => {
        location.reload()
      },
      toggleSidebar: () => {
        window.dispatchEvent(new CustomEvent("quincy:toggleSidebar"))
      },
      toggleAssistant: () => {
        window.dispatchEvent(new CustomEvent("quincy:toggleAssistant"))
      },
      assistantChunk: (detail) => {
        window.dispatchEvent(new CustomEvent("quincy:assistantChunk", { detail }))
      },
      assistantToolUse: (detail) => {
        window.dispatchEvent(new CustomEvent("quincy:assistantToolUse", { detail }))
      },
      assistantDone: (detail) => {
        window.dispatchEvent(new CustomEvent("quincy:assistantDone", { detail }))
      },
      assistantError: (detail) => {
        window.dispatchEvent(new CustomEvent("quincy:assistantError", { detail }))
      },
      assistantApplyEdit: (detail) => {
        window.dispatchEvent(new CustomEvent("quincy:assistantApplyEdit", { detail }))
      },
    },
  },
})

// Instantiating Electroview sets the RPC transport — must happen at module load.
export const electro = new Electroview({ rpc })

void rpc.send.rendererReady({})

// Apply the persisted appearance before first paint settles (dark is the
// default, so a failure here just leaves the host theme).
void rpc.request
  .getPreferences({})
  .then((prefs) => {
    applyTheme(prefs.theme ?? "dark")
    applyEditorFont(prefs.fontFamily ?? "system")
  })
  .catch(() => applyTheme("dark"))
