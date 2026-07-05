import type { ActionPanelItem, ActionPanelExtensionItem, CreateActionItemsOptions, CreateAiItemsOptions } from "./actionPanelTypes"

const AI_PROMPTS: readonly { title: string; prompt: string; keywords: readonly string[] }[] = [
  { title: "Summarize this document", prompt: "Summarize this document", keywords: ["overview", "brief"] },
  {
    title: "Rewrite the first paragraph",
    prompt: "Rewrite the first paragraph to be punchier",
    keywords: ["punchier", "rewrite", "opening"],
  },
  { title: "Fix grammar and spelling", prompt: "Fix grammar and spelling", keywords: ["proofread", "edit"] },
  { title: "Suggest a better title", prompt: "Suggest a better title", keywords: ["headline", "name"] },
]

export function createActionItems(options: CreateActionItemsOptions): ActionPanelItem[] {
  return [
    {
      id: "action:new-file",
      mode: "actions",
      kind: "action",
      title: "New file",
      description: "Create a new markdown file or cloud document",
      keywords: ["create", "document", "markdown"],
      icon: "action",
      shortcut: "Cmd N",
      perform: options.newFile,
    },
    {
      id: "action:close-file",
      mode: "actions",
      kind: "action",
      title: "Close file",
      description: "Close the current editor document",
      keywords: ["close", "document"],
      icon: "action",
      shortcut: "Cmd W",
      disabledReason: options.hasOpenFile ? undefined : "Open a file before closing it",
      perform: options.closeFile,
    },
    {
      id: "action:find",
      mode: "actions",
      kind: "action",
      title: "Find in document",
      description: "Open find and replace in the editor",
      keywords: ["search", "replace", "document"],
      icon: "action",
      shortcut: "Cmd F",
      disabledReason: options.hasOpenFile ? undefined : "Open a file before searching it",
      perform: options.openFind,
    },
    {
      id: "action:export-html",
      mode: "actions",
      kind: "action",
      title: "Export as HTML",
      description: "Write a standalone HTML file beside the markdown file",
      keywords: ["export", "html", "publish"],
      icon: "action",
      shortcut: "Cmd Shift E",
      disabledReason: options.hasOpenFile ? undefined : "Open a local markdown file before exporting",
      perform: options.exportHtml,
    },
    {
      id: "action:settings",
      mode: "actions",
      kind: "action",
      title: "Open settings",
      description: "Open the full settings panel",
      keywords: ["preferences", "theme", "font"],
      icon: "action",
      shortcut: "Cmd ,",
      perform: options.openSettings,
    },
    {
      id: "action:toggle-sidebar",
      mode: "actions",
      kind: "action",
      title: "Toggle sidebar",
      description: "Show or hide the workspace sidebar",
      keywords: ["workspace", "folders", "left"],
      icon: "action",
      shortcut: "Cmd B",
      perform: options.toggleSidebar,
    },
    {
      id: "action:toggle-assistant",
      mode: "actions",
      kind: "action",
      title: "Toggle assistant",
      description: "Show or hide the AI assistant panel",
      keywords: ["ai", "chat", "right"],
      icon: "action",
      shortcut: "Cmd J",
      perform: options.toggleAssistant,
    },
  ]
}

export function createAiItems({ hasDoc, streaming, send, revealAssistant }: CreateAiItemsOptions): ActionPanelItem[] {
  const disabledReason = !hasDoc
    ? "Open a document to use AI actions"
    : streaming
      ? "Wait for the current assistant response to finish"
      : undefined
  return AI_PROMPTS.map((prompt) => ({
    id: `ai:${prompt.title.toLocaleLowerCase().replaceAll(" ", "-")}`,
    mode: "ai",
    kind: "ai",
    title: prompt.title,
    description: "Send this prompt to the document assistant",
    keywords: [prompt.prompt, ...prompt.keywords],
    icon: "ai",
    meta: "Assistant",
    disabledReason,
    perform: async () => {
      await revealAssistant?.()
      await send(prompt.prompt)
    },
  }))
}

export function createExtensionItems(items: readonly ActionPanelExtensionItem[]): ActionPanelItem[] {
  return items.map((item) => ({
    id: `extension:${item.id}`,
    mode: "extensions",
    kind: "extension",
    title: item.title,
    description: item.description,
    keywords: item.keywords ?? [],
    icon: "extension",
    shortcut: item.shortcut,
    disabledReason: item.disabledReason,
    perform: item.perform,
  }))
}
