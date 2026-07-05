import { describe, expect, test } from "bun:test"
import { act } from "react"
import { createRoot } from "react-dom/client"
import { renderToStaticMarkup } from "react-dom/server"
import { Window } from "happy-dom"
import { ACTION_PANEL_MODES, actionPanelEmptyState, type ActionPanelItem } from "./actionPanelModel"
import { QuickOpenModal } from "./QuickOpenModal"

const browserWindow = new Window()
Object.assign(globalThis, {
  window: browserWindow,
  document: browserWindow.document,
  Node: browserWindow.Node,
  Element: browserWindow.Element,
  HTMLElement: browserWindow.HTMLElement,
  SVGElement: browserWindow.SVGElement,
  IS_REACT_ACT_ENVIRONMENT: true,
})

const selectedItem: ActionPanelItem = {
  id: "action:settings",
  mode: "actions",
  kind: "action",
  title: "Open settings",
  description: "Open the full settings panel",
  keywords: ["preferences"],
  shortcut: "Cmd ,",
  perform: () => undefined,
}

const disabledItem: ActionPanelItem = {
  id: "action:export-html",
  mode: "actions",
  kind: "action",
  title: "Export as HTML",
  description: "Write a standalone HTML file",
  keywords: ["export"],
  disabledReason: "Open a local markdown file before exporting",
  perform: () => undefined,
}

const fileItem: ActionPanelItem = {
  id: "file:/workspace/Theme.md",
  mode: "files",
  kind: "file",
  title: "Theme.md",
  description: "/workspace/Theme.md",
  keywords: ["Theme.md", "/workspace/Theme.md"],
  source: { path: "/workspace/Theme.md" },
  perform: () => undefined,
}

const settingItem: ActionPanelItem = {
  id: "setting:theme:light",
  mode: "settings",
  kind: "setting",
  title: "Set appearance to Light",
  description: "Change the app theme immediately",
  keywords: ["theme", "appearance", "Light", "light"],
  perform: () => undefined,
}

function renderModal(items: ActionPanelItem[]) {
  return renderToStaticMarkup(
    <QuickOpenModal
      modes={ACTION_PANEL_MODES}
      activeMode="actions"
      onModeChange={() => undefined}
      query=""
      onQueryChange={() => undefined}
      items={items}
      selectedIndex={0}
      emptyState={actionPanelEmptyState("actions")}
      onSelect={() => undefined}
      onKeyDown={() => undefined}
      onClose={() => undefined}
    />,
  )
}

describe("QuickOpenModal", () => {
  test("renders a labeled modal search surface with mode buttons", () => {
    const html = renderModal([selectedItem])

    expect(html).toContain('role="dialog"')
    expect(html).toContain('aria-modal="true"')
    expect(html).toContain('id="action-panel-title"')
    expect(html).toContain('role="searchbox"')
    expect(html).toContain('aria-label="Search action panel"')
    expect(html).toContain('aria-pressed="true"')
    expect(html).toContain('aria-label="Switch to Actions mode"')
  })

  test("uses the action panel backdrop token", () => {
    const html = renderModal([selectedItem])

    expect(html).toContain("var(--color-backdrop-panel)")
    expect(html).not.toContain("var(--color-backdrop-modal)")
  })

  test("uses the action panel surface token", () => {
    const html = renderModal([selectedItem])

    expect(html).toContain("var(--color-action-panel-bg)")
  })

  test("renders selected and disabled result semantics", () => {
    const html = renderModal([selectedItem, disabledItem])

    expect(html).toContain('role="listbox"')
    expect(html).toContain('role="option"')
    expect(html).toContain('aria-selected="true"')
    expect(html).toContain('aria-disabled="true"')
    expect(html).toContain("Open a local markdown file before exporting")
    expect(html).toContain("Cmd ,")
  })

  test("renders the active mode empty state", () => {
    const html = renderModal([])

    expect(html).toContain("No actions match")
    expect(html).toContain("Search commands like find, export, sidebar, or assistant.")
  })

  test("does not render stale rows from another mode", () => {
    const html = renderModal([fileItem])

    expect(html).toContain("No actions match")
    expect(html).not.toContain("Theme.md")
  })

  test("renders only the first result page for oversized result sets", () => {
    const items = Array.from({ length: 125 }, (_, index): ActionPanelItem => ({
      id: `action:item-${index}`,
      mode: "actions",
      kind: "action",
      title: `Action ${index}`,
      description: "Synthetic action",
      keywords: [],
      perform: () => undefined,
    }))
    const html = renderModal(items)

    expect(html).toContain("Action 99")
    expect(html).not.toContain("Action 100")
    expect(html).toContain("Showing first 100 results")
  })

  test("replaces rendered file rows when props switch to settings rows", async () => {
    const container = document.createElement("div")
    document.body.append(container)
    const root = createRoot(container)

    await act(async () => {
      root.render(
        <QuickOpenModal
          modes={ACTION_PANEL_MODES}
          activeMode="files"
          onModeChange={() => undefined}
          query="theme"
          onQueryChange={() => undefined}
          items={[fileItem]}
          selectedIndex={0}
          emptyState={actionPanelEmptyState("files")}
          onSelect={() => undefined}
          onKeyDown={() => undefined}
          onClose={() => undefined}
        />,
      )
    })
    expect(container.textContent).toContain("Theme.md")

    await act(async () => {
      root.render(
        <QuickOpenModal
          modes={ACTION_PANEL_MODES}
          activeMode="settings"
          onModeChange={() => undefined}
          query="theme"
          onQueryChange={() => undefined}
          items={[settingItem]}
          selectedIndex={0}
          emptyState={actionPanelEmptyState("settings")}
          onSelect={() => undefined}
          onKeyDown={() => undefined}
          onClose={() => undefined}
        />,
      )
    })

    expect(container.textContent).toContain("Set appearance to Light")
    expect(container.textContent).not.toContain("Theme.md")

    await act(async () => root.unmount())
    container.remove()
  })
})
