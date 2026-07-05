import type { ActionPanelItem } from "./actionPanelTypes"

export type {
  ActionPanelEmptyState,
  ActionPanelExtensionItem,
  ActionPanelItem,
  ActionPanelItemKind,
  ActionPanelMode,
  ActionPanelModeId,
  ActionPanelSettingKey,
  ActionPanelSettingValue,
  ActionPanelSettingsState,
  ActionPanelTheme,
  CreateActionItemsOptions,
  CreateAiItemsOptions,
  CreateFileItemsOptions,
  CreateSettingsItemsOptions,
} from "./actionPanelTypes"

export { ACTION_PANEL_MODES, actionPanelEmptyState } from "./actionPanelModes"
export { createActionItems, createAiItems, createExtensionItems } from "./actionPanelCommandItems"
export { createFileItems } from "./actionPanelFileItems"
export { createSettingsItems } from "./actionPanelSettingsItems"

function searchableText(item: ActionPanelItem): string {
  return [item.title, item.description, item.meta, item.shortcut, ...item.keywords]
    .filter((part): part is string => typeof part === "string" && part.length > 0)
    .join(" ")
    .toLocaleLowerCase()
}

function firstEnabledIndex(items: readonly ActionPanelItem[]): number {
  const index = items.findIndex((item) => item.disabledReason === undefined)
  return index === -1 ? (items.length === 0 ? -1 : 0) : index
}

export function filterActionPanelItems(
  items: readonly ActionPanelItem[],
  query: string,
): ActionPanelItem[] {
  const trimmed = query.trim().toLocaleLowerCase()
  if (!trimmed) return [...items]
  return items.filter((item) => searchableText(item).includes(trimmed))
}

export function moveActionPanelSelection(
  items: readonly ActionPanelItem[],
  selectedIndex: number,
  delta: number,
): number {
  if (items.length === 0) return -1
  if (items.every((item) => item.disabledReason !== undefined)) return 0

  let index = selectedIndex
  for (let step = 0; step < items.length; step += 1) {
    index = (index + delta + items.length) % items.length
    if (!items[index]?.disabledReason) return index
  }
  return firstEnabledIndex(items)
}

export function normalizeActionPanelSelection(
  items: readonly ActionPanelItem[],
  selectedIndex: number,
): number {
  if (items.length === 0) return -1
  const bounded = Math.max(0, Math.min(selectedIndex, items.length - 1))
  if (!items[bounded]?.disabledReason) return bounded
  return firstEnabledIndex(items)
}

export async function executeActionPanelItem(item: ActionPanelItem): Promise<boolean> {
  if (item.disabledReason) return false
  return (await item.perform()) !== false
}
