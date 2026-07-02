import { useCallback, useEffect, useState } from "react"
import type { EditorFontFamily, EditorMode } from "../../../shared/types"
import { rpc } from "../rpc/client"
import { reportAppError } from "../errors"
import { applyEditorFont, applyTheme, type ThemePreference } from "../theme"

export interface SettingsState {
  theme: ThemePreference
  fontFamily: EditorFontFamily
  defaultEditorMode: EditorMode
}

/** Loads preferences when the panel opens; changes apply immediately and
 *  persist through the bun-side preferences store. */
export function useSettings(isOpen: boolean) {
  const [settings, setSettings] = useState<SettingsState | null>(null)

  useEffect(() => {
    if (!isOpen) return
    rpc.request
      .getPreferences({})
      .then((prefs) =>
        setSettings({
          theme: prefs.theme ?? "dark",
          fontFamily: prefs.fontFamily ?? "system",
          defaultEditorMode: prefs.defaultEditorMode ?? "split",
        }),
      )
      .catch((error) => reportAppError("Couldn't load settings", error))
  }, [isOpen])

  const update = useCallback(<K extends keyof SettingsState>(key: K, value: SettingsState[K]) => {
    setSettings((current) => (current ? { ...current, [key]: value } : current))
    if (key === "theme") applyTheme(value as ThemePreference)
    if (key === "fontFamily") applyEditorFont(value as EditorFontFamily)
    rpc.request
      .setPreferences({ [key]: value })
      .catch((error) => reportAppError("Couldn't save setting", error))
  }, [])

  return { settings, update }
}

/** Modal visibility driven by the Quincy > Settings… menu (⌘,). */
export function useSettingsModal() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const show = () => setVisible(true)
    window.addEventListener("quincy:showSettings", show)
    return () => window.removeEventListener("quincy:showSettings", show)
  }, [])

  return { visible, close: useCallback(() => setVisible(false), []) }
}
