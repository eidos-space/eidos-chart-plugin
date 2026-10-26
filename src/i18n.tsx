import { createContext, useContext, useSyncExternalStore } from "react"
import type { PluginI18n } from "@eidos.space/plugin-sdk"
export const I18nContext = createContext<PluginI18n | null>(null)
export function usePluginI18n(): PluginI18n {
  const i18n = useContext(I18nContext)
  if (!i18n) throw new Error("Missing plugin language context")
  useSyncExternalStore(
    listener => {
      const subscription = i18n.onDidChangeLocale(listener)
      return () => subscription.dispose()
    },
    () => i18n.locale
  )
  return i18n
}
