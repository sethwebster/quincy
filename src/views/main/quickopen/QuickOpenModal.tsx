import { memo, useEffect, useMemo, useRef, type CSSProperties, type KeyboardEvent, type RefObject } from "react"
import { Search } from "lucide-react"
import { Glass } from "../components/Glass"
import type {
  ActionPanelEmptyState,
  ActionPanelItem,
  ActionPanelMode,
  ActionPanelModeId,
} from "./actionPanelModel"
import { ActionPanelRow, actionPanelRowId } from "./QuickOpenModalRow"

const SEARCHBOX_ROLE = { role: "searchbox" } as const
const MAX_RENDERED_RESULTS = 100

interface QuickOpenModalProps {
  readonly modes: readonly ActionPanelMode[]
  readonly activeMode: ActionPanelModeId
  readonly onModeChange: (mode: ActionPanelModeId) => void
  readonly query: string
  readonly onQueryChange: (query: string) => void
  readonly items: readonly ActionPanelItem[]
  readonly selectedIndex: number
  readonly emptyState: ActionPanelEmptyState
  readonly onSelect: (item: ActionPanelItem) => void | Promise<void>
  readonly onKeyDown: (event: KeyboardEvent) => void
  readonly onClose: () => void
}

interface ActionPanelResultsProps {
  readonly items: readonly ActionPanelItem[]
  readonly selectedIndex: number
  readonly emptyState: ActionPanelEmptyState
  readonly onSelect: (item: ActionPanelItem) => void | Promise<void>
}

function useAutoFocus(ref: RefObject<HTMLInputElement | null>) {
  useEffect(() => {
    ref.current?.focus()
  }, [ref])
}

function useScrollIntoView(
  containerRef: RefObject<HTMLDivElement | null>,
  selectedIndex: number,
) {
  useEffect(() => {
    const container = containerRef.current
    const item = container?.children.item(selectedIndex)
    if (item instanceof HTMLElement) item.scrollIntoView({ block: "nearest" })
  }, [containerRef, selectedIndex])
}

function modeButtonStyle(selected: boolean): CSSProperties {
  return {
    background: selected ? "var(--color-accent-dim)" : "transparent",
    border: selected ? "1px solid var(--color-accent)" : "1px solid transparent",
    color: selected ? "var(--color-accent)" : "var(--color-text-secondary)",
  }
}

const ActionPanelResults = memo(function ActionPanelResults({
  items,
  selectedIndex,
  emptyState,
  onSelect,
}: ActionPanelResultsProps) {
  const visibleItems = useMemo(() => items.slice(0, MAX_RENDERED_RESULTS), [items])

  if (items.length === 0) {
    return (
      <div className="px-6 py-8 text-center">
        <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
          {emptyState.title}
        </p>
        <p className="mt-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
          {emptyState.description}
        </p>
      </div>
    )
  }

  return (
    <>
      {visibleItems.map((item, index) => (
        <ActionPanelRow
          key={item.id}
          item={item}
          selected={index === selectedIndex}
          onSelect={onSelect}
        />
      ))}
      {items.length > visibleItems.length ? (
        <div className="px-4 py-2 text-xs" style={{ color: "var(--color-text-muted)" }}>
          Showing first {visibleItems.length} results. Keep typing to narrow the list.
        </div>
      ) : null}
    </>
  )
})

export function QuickOpenModal({
  modes,
  activeMode,
  onModeChange,
  query,
  onQueryChange,
  items,
  selectedIndex,
  emptyState,
  onSelect,
  onKeyDown,
  onClose,
}: QuickOpenModalProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)

  useAutoFocus(inputRef)
  useScrollIntoView(listRef, selectedIndex)

  const activeModeItems = useMemo(
    () => items.filter((item) => item.mode === activeMode),
    [activeMode, items],
  )
  const selectedItem = activeModeItems[selectedIndex]
  const activeDescendant = selectedItem ? actionPanelRowId(selectedItem.id) : undefined

  return (
    <div
      className="fixed inset-0 z-50 flex justify-center"
      style={{ paddingTop: "15vh" }}
    >
      <button
        type="button"
        aria-label="Close action panel"
        className="absolute inset-0 cursor-default"
        style={{ background: "var(--color-backdrop-action-panel)" }}
        onClick={onClose}
      />

      <Glass
        elevated
        role="dialog"
        aria-modal="true"
        aria-labelledby="action-panel-title"
        onKeyDown={onKeyDown}
        className="relative z-10 flex max-h-[460px] w-[640px] flex-col overflow-hidden rounded-xl"
        style={{ background: "var(--color-action-panel-bg)" }}
      >
        <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--color-glass-border)" }}>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 id="action-panel-title" className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                Action panel
              </h2>
              <p className="mt-0.5 text-xs" style={{ color: "var(--color-text-muted)" }}>
                Switch modes, search, and run commands from one glass surface.
              </p>
            </div>
          </div>

          <div
            className="mt-3 flex gap-1 rounded-lg p-1"
            style={{ background: "var(--color-glass-bg)", border: "1px solid var(--color-glass-border)" }}
          >
            {modes.map((mode) => {
              const selected = mode.id === activeMode
              return (
                <button
                  key={mode.id}
                  type="button"
                  aria-label={`Switch to ${mode.label} mode`}
                  aria-pressed={selected}
                  title={mode.description}
                  className="no-drag flex flex-1 items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors"
                  style={modeButtonStyle(selected)}
                  onClick={() => onModeChange(mode.id)}
                >
                  <span>{mode.label}</span>
                  <span style={{ color: selected ? "var(--color-accent)" : "var(--color-text-muted)" }}>
                    {mode.shortcut}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <div
          className="flex items-center gap-3 px-4 py-3"
          style={{ borderBottom: "1px solid var(--color-glass-border)" }}
        >
          <Search size={16} aria-hidden="true" style={{ color: "var(--color-text-muted)", flexShrink: 0 }} />
          <input
            ref={inputRef}
            {...SEARCHBOX_ROLE}
            aria-label="Search action panel"
            aria-controls="action-panel-results"
            aria-activedescendant={activeDescendant}
            type="search"
            placeholder="Search actions, settings, files, and prompts..."
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            className="no-drag w-full bg-transparent text-sm outline-none"
            style={{ color: "var(--color-text-primary)" }}
          />
        </div>

        <div
          ref={listRef}
          id="action-panel-results"
          role="listbox"
          className="flex-1 overflow-y-auto py-1"
          aria-label="Action panel results"
        >
          <ActionPanelResults
            key={activeMode}
            items={activeModeItems}
            selectedIndex={selectedIndex}
            emptyState={emptyState}
            onSelect={onSelect}
          />
        </div>
      </Glass>
    </div>
  )
}
