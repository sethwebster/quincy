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
    },
  },
})

// Instantiating Electroview sets the RPC transport — must happen at module load.
export const electro = new Electroview({ rpc })
