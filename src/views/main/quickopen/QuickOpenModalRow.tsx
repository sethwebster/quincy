import { Bot, FileText, Puzzle, Settings, Sparkles, Text } from "lucide-react"
import { memo, type CSSProperties } from "react"
import type { LucideIcon } from "lucide-react"
import type { ActionPanelItem, ActionPanelItemKind } from "./actionPanelModel"

const ITEM_ICONS: Record<ActionPanelItemKind, LucideIcon> = {
  file: FileText,
  content: Text,
  setting: Settings,
  action: Sparkles,
  ai: Bot,
  extension: Puzzle,
} as const

function itemButtonStyle(selected: boolean): CSSProperties {
  return {
    background: selected ? "var(--color-glass-hover)" : "transparent",
    color: "var(--color-text-primary)",
  }
}

export function actionPanelRowId(itemId: string): string {
  return `action-panel-item-${itemId.replace(/[^A-Za-z0-9_-]/g, "-")}`
}

export interface ActionPanelRowProps {
  readonly item: ActionPanelItem
  readonly selected: boolean
  readonly onSelect: (item: ActionPanelItem) => void | Promise<void>
}

export const ActionPanelRow = memo(function ActionPanelRow({ item, selected, onSelect }: ActionPanelRowProps) {
  const Icon = ITEM_ICONS[item.icon ?? item.kind]
  const disabled = item.disabledReason !== undefined
  const source = item.source?.lineNumber ? `${item.source.path}:${item.source.lineNumber}` : item.source?.path

  return (
    <button
      id={actionPanelRowId(item.id)}
      type="button"
      role="option"
      aria-selected={selected}
      aria-disabled={disabled}
      disabled={disabled}
      className="no-drag flex w-full items-start gap-3 px-4 py-2.5 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-45"
      style={itemButtonStyle(selected)}
      onClick={() => onSelect(item)}
    >
      <Icon
        size={14}
        aria-hidden="true"
        className="mt-0.5 shrink-0"
        style={{ color: selected ? "var(--color-accent)" : "var(--color-text-muted)" }}
      />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate font-medium">{item.title}</span>
          {item.shortcut ? (
            <span
              className="shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium"
              style={{ background: "var(--color-glass-bg)", color: "var(--color-text-muted)" }}
            >
              {item.shortcut}
            </span>
          ) : null}
        </span>
        <span className="mt-0.5 block truncate text-xs" style={{ color: "var(--color-text-secondary)" }}>
          {item.description}
        </span>
        {source ? (
          <span className="mt-0.5 block truncate text-xs" style={{ color: "var(--color-text-muted)" }}>
            {source}
          </span>
        ) : null}
        {item.disabledReason ? (
          <span className="mt-1 block text-xs" style={{ color: "var(--color-warning)" }}>
            {item.disabledReason}
          </span>
        ) : null}
      </span>
      {item.meta ? (
        <span className="mt-0.5 shrink-0 text-xs" style={{ color: "var(--color-text-muted)" }}>
          {item.meta}
        </span>
      ) : null}
    </button>
  )
})
