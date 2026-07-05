import { describe, expect, mock, test } from "bun:test"
import { act, useEffect, useLayoutEffect } from "react"
import { createRoot } from "react-dom/client"
import { flushSync } from "react-dom"
import type { Root } from "react-dom/client"
import { Window } from "happy-dom"
import type { DirEntry, EditorMode, EditorSelectionRange } from "../../../shared/types"

const WORKSPACE_FOLDERS = ["/workspace"]
const noop = () => undefined
const editorState = {
  mode: "split" as EditorMode,
  activeDocumentId: null,
  activeFilePath: null,
  openFile: (_path: string, _content: string, _mtimeMs: number) => undefined,
  closeFile: noop,
  setSelection: (_mode: EditorMode, _selection: EditorSelectionRange) => undefined,
}
const settingsState = {
  settings: { theme: "dark" as const, fontFamily: "system" as const, defaultEditorMode: "split" as const },
  update: noop,
}
const quickOpenOptions = {
  openSettings: noop,
  openFind: noop,
  toggleSidebar: noop,
  toggleAssistant: noop,
  showAssistant: noop,
  assistant: { hasDoc: false, streaming: false, send: noop },
  extensionItems: [],
}
type SearchFiles = (params: { readonly roots: string[] }) => Promise<DirEntry[]>
type ReadFile = (params: { readonly path: string }) => Promise<{ readonly content: string; readonly mtimeMs: number }>
let searchFiles: SearchFiles = async () => [
  { name: "Plan.md", path: "/workspace/Plan.md", isDirectory: false },
]
let readFile: ReadFile = async () => ({ content: "# Plan", mtimeMs: 1 })

function deferred<T>(): { readonly promise: Promise<T>; readonly resolve: (value: T) => void } {
  let resolvePromise: (value: T) => void = () => undefined
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve
  })
  return { promise, resolve: resolvePromise }
}

const browserWindow = new Window()
Object.assign(globalThis, {
  window: browserWindow,
  document: browserWindow.document,
  Node: browserWindow.Node,
  HTMLElement: browserWindow.HTMLElement,
  KeyboardEvent: browserWindow.KeyboardEvent,
  Event: browserWindow.Event,
  CustomEvent: browserWindow.CustomEvent,
  navigator: browserWindow.navigator,
  IS_REACT_ACT_ENVIRONMENT: true,
})

mock.module("../rpc/client", () => ({
  rpc: {
    request: {
      searchFiles: (params: { readonly roots: string[] }) => searchFiles(params),
      readFile: (params: { readonly path: string }) => readFile(params),
      searchContent: async () => [],
    },
  },
}))

mock.module("../editor/EditorContext", () => ({
  useEditor: () => editorState,
}))

mock.module("../settings/useSettings", () => ({
  useSettings: () => settingsState,
}))

const { useQuickOpen } = await import("./useQuickOpen")
type QuickOpenState = ReturnType<typeof useQuickOpen>

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

interface HarnessProps {
  readonly folders?: string[]
  readonly onRender?: (quickOpen: QuickOpenState) => void
}

function Harness({ folders = WORKSPACE_FOLDERS, onRender }: HarnessProps) {
  const quickOpen = useQuickOpen(folders, quickOpenOptions)

  useEffect(() => {
    quickOpen.open()
  }, [quickOpen.open])

  useLayoutEffect(() => {
    onRender?.(quickOpen)
  })

  return (
    <button type="button" data-open={String(quickOpen.isOpen)} data-mode={quickOpen.activeMode} data-query={quickOpen.query} onKeyDown={quickOpen.handleKeyDown}>
      {quickOpen.items.map((item) => (
        <span key={item.id} data-kind={item.kind}>{item.title}</span>
      ))}
    </button>
  )
}

function mountHarness(): { readonly root: Root; readonly container: HTMLDivElement } {
  const container = document.createElement("div")
  document.body.append(container)
  return { root: createRoot(container), container }
}

function requireQuickOpen(quickOpen: QuickOpenState | null): QuickOpenState {
  if (quickOpen === null) throw new Error("quick open harness state was not captured")
  return quickOpen
}

function requireQuickOpenTarget(container: HTMLDivElement): HTMLElement {
  const target = container.querySelector("[data-mode]")
  if (!(target instanceof HTMLElement)) throw new Error("quick open harness did not render")
  return target
}

function requireFirstItem(quickOpen: QuickOpenState): QuickOpenState["items"][number] {
  const item = quickOpen.items[0]
  if (!item) throw new Error("quick open harness rendered no items")
  return item
}

describe("useQuickOpen", () => {
  test("should render action rows after the command-number mode shortcut", async () => {
    const { root, container } = mountHarness()

    await act(async () => {
      root.render(<Harness />)
      await Promise.resolve()
      await sleep(0)
    })
    expect(container.textContent).toContain("Plan.md")

    const target = requireQuickOpenTarget(container)
    await act(async () => {
      target.dispatchEvent(new KeyboardEvent("keydown", { key: "3", metaKey: true, bubbles: true }))
      await Promise.resolve()
    })

    expect(target.dataset.mode).toBe("actions")
    expect(container.textContent).toContain("New file")
    expect(container.textContent).not.toContain("Plan.md")

    await act(async () => root.unmount())
    container.remove()
  })

  test("should load a new folder set and ignore a stale file index result", async () => {
    const first = deferred<DirEntry[]>()
    const second = deferred<DirEntry[]>()
    const rootsSeen: string[] = []
    searchFiles = async ({ roots }) => {
      rootsSeen.push(roots.join(","))
      return roots[0] === "/one" ? first.promise : second.promise
    }
    const { root, container } = mountHarness()

    await act(async () => {
      root.render(<Harness folders={["/one"]} />)
      await Promise.resolve()
    })
    await act(async () => {
      root.render(<Harness folders={["/two"]} />)
      await Promise.resolve()
    })

    expect(rootsSeen).toEqual(["/one", "/two"])
    await act(async () => {
      first.resolve([{ name: "Old.md", path: "/one/Old.md", isDirectory: false }])
      await Promise.resolve()
    })
    expect(container.textContent).not.toContain("Old.md")

    await act(async () => {
      second.resolve([{ name: "New.md", path: "/two/New.md", isDirectory: false }])
      await Promise.resolve()
    })
    expect(container.textContent).toContain("New.md")

    await act(async () => root.unmount())
    container.remove()
    searchFiles = async () => [
      { name: "Plan.md", path: "/workspace/Plan.md", isDirectory: false },
    ]
  })

  test("should filter rows in sync with the query and execute the displayed selection", async () => {
    searchFiles = async () => [
      { name: "Plan.md", path: "/workspace/Plan.md", isDirectory: false },
      { name: "Beta.md", path: "/workspace/Beta.md", isDirectory: false },
    ]
    const openedPaths: string[] = []
    editorState.openFile = (path: string, _content: string, _mtimeMs: number) => {
      openedPaths.push(path)
      return undefined
    }
    let quickOpen: QuickOpenState | null = null
    const { root, container } = mountHarness()

    await act(async () => {
      root.render(<Harness onRender={(nextQuickOpen) => { quickOpen = nextQuickOpen }} />)
      await Promise.resolve()
      await sleep(0)
    })
    expect(container.textContent).toContain("Plan.md")

    await act(async () => {
      flushSync(() => {
        requireQuickOpen(quickOpen).setQuery("Beta")
      })
      const renderedTarget = requireQuickOpenTarget(container)
      expect(renderedTarget.dataset.query).toBe("Beta")
      expect(container.textContent).toContain("Beta.md")
      expect(container.textContent).not.toContain("Plan.md")
      renderedTarget.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }))
      await Promise.resolve()
    })
    expect(openedPaths).toEqual(["/workspace/Beta.md"])

    expect(container.textContent).toBe("")

    await act(async () => root.unmount())
    container.remove()
    editorState.openFile = (_path: string, _content: string, _mtimeMs: number) => undefined
    searchFiles = async () => [
      { name: "Plan.md", path: "/workspace/Plan.md", isDirectory: false },
    ]
  })

  test("should show only new-mode rows when switching immediately after typing", async () => {
    searchFiles = async () => [
      { name: "Theme-plan.md", path: "/workspace/Theme-plan.md", isDirectory: false },
      { name: "Other.md", path: "/workspace/Other.md", isDirectory: false },
    ]
    let quickOpen: QuickOpenState | null = null
    const { root, container } = mountHarness()

    await act(async () => {
      root.render(<Harness onRender={(nextQuickOpen) => { quickOpen = nextQuickOpen }} />)
      await Promise.resolve()
      await sleep(0)
    })
    expect(container.textContent).toContain("Theme-plan.md")

    await act(async () => {
      flushSync(() => {
        requireQuickOpen(quickOpen).setQuery("theme")
      })
      flushSync(() => {
        requireQuickOpen(quickOpen).setActiveMode("settings")
      })
      await Promise.resolve()
    })

    expect(requireQuickOpenTarget(container).dataset.mode).toBe("settings")
    expect(container.querySelectorAll("[data-kind='file']")).toHaveLength(0)
    expect(container.querySelectorAll("[data-kind='setting']").length).toBeGreaterThan(0)
    expect(container.textContent).not.toContain("Theme-plan.md")

    await act(async () => root.unmount())
    container.remove()
    searchFiles = async () => [
      { name: "Plan.md", path: "/workspace/Plan.md", isDirectory: false },
    ]
  })

  test("should keep the panel open when opening the selected file fails", async () => {
    searchFiles = async () => [
      { name: "Plan.md", path: "/workspace/Plan.md", isDirectory: false },
    ]
    readFile = async () => {
      throw new Error("read denied")
    }
    const openedPaths: string[] = []
    editorState.openFile = (path: string, _content: string, _mtimeMs: number) => {
      openedPaths.push(path)
      return undefined
    }
    const { root, container } = mountHarness()

    await act(async () => {
      root.render(<Harness />)
      await Promise.resolve()
      await sleep(0)
    })

    await act(async () => {
      requireQuickOpenTarget(container).dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }))
      await Promise.resolve()
    })

    expect(openedPaths).toEqual([])
    expect(requireQuickOpenTarget(container).dataset.open).toBe("true")
    expect(container.textContent).toContain("Plan.md")

    await act(async () => root.unmount())
    container.remove()
    readFile = async () => ({ content: "# Plan", mtimeMs: 1 })
    editorState.openFile = (_path: string, _content: string, _mtimeMs: number) => undefined
  })

  test("should replace file rows when switching to settings with an active query", async () => {
    searchFiles = async () => [
      { name: "Theme-plan.md", path: "/workspace/Theme-plan.md", isDirectory: false },
      { name: "Other.md", path: "/workspace/Other.md", isDirectory: false },
    ]
    let quickOpen: QuickOpenState | null = null
    const { root, container } = mountHarness()

    await act(async () => {
      root.render(<Harness onRender={(nextQuickOpen) => { quickOpen = nextQuickOpen }} />)
      await Promise.resolve()
      await sleep(0)
    })
    expect(container.textContent).toContain("Theme-plan.md")

    await act(async () => {
      requireQuickOpen(quickOpen).setQuery("theme")
      await Promise.resolve()
      await sleep(0)
    })
    expect(container.textContent).toContain("Theme-plan.md")

    await act(async () => {
      requireQuickOpen(quickOpen).setActiveMode("settings")
      await Promise.resolve()
    })

    expect(requireQuickOpenTarget(container).dataset.mode).toBe("settings")
    expect(container.querySelectorAll("[data-kind='file']")).toHaveLength(0)
    expect(container.querySelectorAll("[data-kind='setting']").length).toBeGreaterThan(0)
    expect(container.textContent).toContain("Set appearance")
    expect(container.textContent).not.toContain("Theme-plan.md")

    await act(async () => root.unmount())
    container.remove()
    searchFiles = async () => [
      { name: "Plan.md", path: "/workspace/Plan.md", isDirectory: false },
    ]
  })

  test("should not execute a stale item from a previous mode", async () => {
    searchFiles = async () => [
      { name: "Plan.md", path: "/workspace/Plan.md", isDirectory: false },
    ]
    const openedPaths: string[] = []
    editorState.openFile = (path: string, _content: string, _mtimeMs: number) => {
      openedPaths.push(path)
      return undefined
    }
    let quickOpen: QuickOpenState | null = null
    const { root, container } = mountHarness()

    await act(async () => {
      root.render(<Harness onRender={(nextQuickOpen) => { quickOpen = nextQuickOpen }} />)
      await Promise.resolve()
      await sleep(0)
    })
    const staleFileItem = requireFirstItem(requireQuickOpen(quickOpen))
    expect(staleFileItem.mode).toBe("files")

    await act(async () => {
      requireQuickOpen(quickOpen).setActiveMode("actions")
      await Promise.resolve()
    })
    expect(requireQuickOpenTarget(container).dataset.mode).toBe("actions")

    await act(async () => {
      await requireQuickOpen(quickOpen).selectItem(staleFileItem)
    })

    expect(openedPaths).toEqual([])
    expect(requireQuickOpenTarget(container).dataset.open).toBe("true")
    expect(container.textContent).toContain("New file")
    expect(container.textContent).not.toContain("Plan.md")

    await act(async () => root.unmount())
    container.remove()
    editorState.openFile = (_path: string, _content: string, _mtimeMs: number) => undefined
    searchFiles = async () => [
      { name: "Plan.md", path: "/workspace/Plan.md", isDirectory: false },
    ]
  })

  test("should cap large file indexes before rendering rows", async () => {
    searchFiles = async () => Array.from({ length: 250 }, (_, index) => ({
      name: `File-${index}.md`,
      path: `/workspace/File-${index}.md`,
      isDirectory: false,
    }))
    let quickOpen: QuickOpenState | null = null
    const { root, container } = mountHarness()

    await act(async () => {
      root.render(<Harness onRender={(nextQuickOpen) => { quickOpen = nextQuickOpen }} />)
      await Promise.resolve()
      await sleep(0)
    })

    expect(requireQuickOpen(quickOpen).items).toHaveLength(100)
    expect(container.querySelectorAll("[data-kind='file']")).toHaveLength(100)
    expect(container.textContent).toContain("File-99.md")
    expect(container.textContent).not.toContain("File-100.md")

    await act(async () => root.unmount())
    container.remove()
    searchFiles = async () => [
      { name: "Plan.md", path: "/workspace/Plan.md", isDirectory: false },
    ]
  })
})
