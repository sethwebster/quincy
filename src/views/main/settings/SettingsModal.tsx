import { motion } from "framer-motion"
import { X } from "lucide-react"
import { Glass } from "../components/Glass"
import { useSettings, type SettingsState } from "./useSettings"

interface SettingsModalProps {
  onClose: () => void
}

interface OptionRowProps<K extends keyof SettingsState> {
  label: string
  settingKey: K
  options: { value: SettingsState[K]; label: string }[]
  value: SettingsState[K]
  onChange: (key: K, value: SettingsState[K]) => void
}

function OptionRow<K extends keyof SettingsState>({
  label,
  settingKey,
  options,
  value,
  onChange,
}: OptionRowProps<K>) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <span className="text-sm" style={{ color: "var(--color-text-primary)" }}>
        {label}
      </span>
      <div
        className="flex gap-0.5 rounded-lg p-0.5"
        style={{ background: "var(--color-glass-bg)", border: "1px solid var(--color-glass-border)" }}
        role="radiogroup"
        aria-label={label}
      >
        {options.map((option) => {
          const selected = option.value === value
          return (
            <button
              key={String(option.value)}
              role="radio"
              aria-checked={selected}
              className="no-drag rounded-md px-3 py-1 text-xs font-medium transition-colors"
              style={{
                background: selected ? "var(--color-accent-dim)" : "transparent",
                color: selected ? "var(--color-accent)" : "var(--color-text-secondary)",
              }}
              onClick={() => onChange(settingKey, option.value)}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div
      className="px-4 pb-1 pt-4 text-xs font-semibold tracking-wider"
      style={{ color: "var(--color-text-muted)" }}
    >
      {title.toUpperCase()}
    </div>
  )
}

export function SettingsModal({ onClose }: SettingsModalProps) {
  const { settings, update } = useSettings(true)

  return (
    <motion.div
      className="fixed inset-0 z-50 flex justify-center"
      style={{ paddingTop: "18vh" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.12 }}
    >
      <div
        className="absolute inset-0"
        style={{ background: "var(--color-backdrop-panel)" }}
        onClick={onClose}
      />
      <Glass elevated className="relative flex h-fit w-[460px] flex-col overflow-hidden rounded-xl pb-3">
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: "1px solid var(--color-glass-border)" }}
        >
          <span className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
            Settings
          </span>
          <button
            className="no-drag flex h-6 w-6 items-center justify-center rounded"
            aria-label="Close settings"
            onClick={onClose}
            style={{ color: "var(--color-text-muted)" }}
          >
            <X size={14} />
          </button>
        </div>

        {settings && (
          <>
            <SectionHeader title="Appearance" />
            <OptionRow
              label="Theme"
              settingKey="theme"
              value={settings.theme}
              onChange={update}
              options={[
                { value: "dark", label: "Dark" },
                { value: "light", label: "Light" },
                { value: "system", label: "System" },
              ]}
            />

            <SectionHeader title="Editor" />
            <OptionRow
              label="Default mode at launch"
              settingKey="defaultEditorMode"
              value={settings.defaultEditorMode}
              onChange={update}
              options={[
                { value: "rich", label: "Rich" },
                { value: "split", label: "Split" },
                { value: "source", label: "Source" },
              ]}
            />
            <OptionRow
              label="Editor font"
              settingKey="fontFamily"
              value={settings.fontFamily}
              onChange={update}
              options={[
                { value: "system", label: "System" },
                { value: "serif", label: "Serif" },
                { value: "mono", label: "Mono" },
              ]}
            />
          </>
        )}
      </Glass>
    </motion.div>
  )
}
