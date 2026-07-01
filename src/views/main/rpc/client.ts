import { Electroview } from "electrobun/view"
import type { AppRPC } from "../../../shared/types"

export const rpc = Electroview.defineRPC<AppRPC>({
  maxRequestTime: Infinity,
  handlers: {
    requests: {},
    messages: {
      themeChanged: ({ theme }) => {
        document.documentElement.setAttribute("data-theme", theme)
      },
      workspaceFoldersChanged: ({ folders }) => {
        window.dispatchEvent(
          new CustomEvent("quincy:workspaceFoldersChanged", { detail: folders }),
        )
      },
      closeFile: () => {
        window.dispatchEvent(new CustomEvent("quincy:closeFile"))
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
    },
  },
})

// Instantiating Electroview sets the RPC transport — must happen at module load.
export const electro = new Electroview({ rpc })

void rpc.send.rendererReady({})
