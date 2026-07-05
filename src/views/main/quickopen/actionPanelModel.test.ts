import { describe, expect, test } from "bun:test"
import {
  ACTION_PANEL_MODES,
  actionPanelEmptyState,
  createActionItems,
  createAiItems,
  createExtensionItems,
  createFileItems,
  createSettingsItems,
  executeActionPanelItem,
  filterActionPanelItems,
  moveActionPanelSelection,
} from "./actionPanelModel"

describe("actionPanelModel", () => {
  test("builds the requested mode registry in order", () => {
    expect(ACTION_PANEL_MODES.map((mode) => mode.label)).toEqual([
      "Files",
      "Settings",
      "Actions",
      "AI",
      "Extensions",
    ])
  })

  test("builds file and content switcher items and filters by path or snippet", () => {
    const files = [
      { name: "Plan.md", path: "/workspace/docs/Plan.md", isDirectory: false },
      { name: "Meeting.md", path: "/workspace/notes/Meeting.md", isDirectory: false },
    ]
    const contentMatches = [
      { name: "Roadmap.md", path: "/workspace/Roadmap.md", lineNumber: 12, snippet: "Ship robust action panel" },
    ]

    const items = createFileItems({ files, contentMatches, openFile: () => undefined })
    expect(items.map((item) => `${item.kind}:${item.title}`)).toEqual([
      "file:Plan.md",
      "file:Meeting.md",
      "content:Roadmap.md:12",
    ])
    expect(filterActionPanelItems(items, "robust").map((item) => item.title)).toEqual(["Roadmap.md:12"])
    expect(filterActionPanelItems(items, "docs").map((item) => item.title)).toEqual(["Plan.md"])
  })

  test("builds settings setter rows with current values disabled", async () => {
    const changes: string[] = []
    const items = createSettingsItems({
      settings: { theme: "dark", fontFamily: "system", defaultEditorMode: "split" },
      update: (key, value) => {
        changes.push(`${key}:${value}`)
      },
    })
    const darkTheme = items.find((item) => item.id === "setting:theme:dark")
    const lightTheme = items.find((item) => item.id === "setting:theme:light")

    expect(darkTheme?.disabledReason).toBe("Already using Dark appearance")
    expect(lightTheme?.disabledReason).toBeUndefined()
    expect(await executeActionPanelItem(darkTheme!)).toBe(false)
    expect(await executeActionPanelItem(lightTheme!)).toBe(true)
    expect(changes).toEqual(["theme:light"])
  })

  test("builds action taker rows and keeps unavailable actions inert", async () => {
    const events: string[] = []
    const items = createActionItems({
      hasOpenFile: false,
      newFile: () => {
        events.push("new")
      },
      closeFile: () => {
        events.push("close")
      },
      openFind: () => {
        events.push("find")
      },
      exportHtml: () => {
        events.push("export")
      },
      openSettings: () => {
        events.push("settings")
      },
      toggleSidebar: () => {
        events.push("sidebar")
      },
      toggleAssistant: () => {
        events.push("assistant")
      },
    })

    const closeFile = items.find((item) => item.id === "action:close-file")
    const settings = items.find((item) => item.id === "action:settings")
    expect(closeFile?.disabledReason).toBe("Open a file before closing it")
    expect(await executeActionPanelItem(closeFile!)).toBe(false)
    expect(await executeActionPanelItem(settings!)).toBe(true)
    expect(events).toEqual(["settings"])
  })

  test("builds AI leverager rows with document and streaming guards", async () => {
    const prompts: string[] = []
    const send = (prompt: string) => {
      prompts.push(prompt)
    }
    const disabled = createAiItems({ hasDoc: false, streaming: false, send })
    expect(disabled[0]?.disabledReason).toBe("Open a document to use AI actions")
    expect(await executeActionPanelItem(disabled[0]!)).toBe(false)

    const enabled = createAiItems({ hasDoc: true, streaming: false, send })
    expect(await executeActionPanelItem(enabled[0]!)).toBe(true)
    expect(prompts).toEqual(["Summarize this document"])

    const streaming = createAiItems({ hasDoc: true, streaming: true, send })
    expect(streaming[0]?.disabledReason).toBe("Wait for the current assistant response to finish")
  })

  test("supports explicit extension rows and an empty extension state", () => {
    expect(actionPanelEmptyState("extensions")).toEqual({
      title: "No extensions registered",
      description: "Extension actions can be added through the action panel item registry.",
    })
    const items = createExtensionItems([
      {
        id: "lint-doc",
        title: "Lint current document",
        description: "Run a workspace extension command",
        keywords: ["markdown", "quality"],
        perform: () => undefined,
      },
    ])
    expect(items[0]).toMatchObject({ id: "extension:lint-doc", mode: "extensions", kind: "extension" })
    expect(filterActionPanelItems(items, "quality")).toHaveLength(1)
  })

  test("moves selection across enabled rows and never executes disabled rows", () => {
    const items = createActionItems({
      hasOpenFile: false,
      newFile: () => undefined,
      closeFile: () => undefined,
      openFind: () => undefined,
      exportHtml: () => undefined,
      openSettings: () => undefined,
      toggleSidebar: () => undefined,
      toggleAssistant: () => undefined,
    })
    const closeIndex = items.findIndex((item) => item.id === "action:close-file")
    const nextIndex = moveActionPanelSelection(items, closeIndex, 1)

    expect(items[closeIndex]?.disabledReason).toBeDefined()
    expect(items[nextIndex]?.disabledReason).toBeUndefined()
  })
})
