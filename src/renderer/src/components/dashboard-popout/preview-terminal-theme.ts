import { useMemo } from 'react'
import type { ITheme } from '@xterm/xterm'
import { useShallow } from 'zustand/react/shallow'
import { composeActiveTerminalTheme } from '@/components/terminal-pane/terminal-appearance'
import { useSystemPrefersDark } from '@/components/terminal-pane/use-system-prefers-dark'
import { getBuiltinTheme, resolveEffectiveTerminalAppearance } from '@/lib/terminal-theme'
import type { GlobalSettings } from '../../../../shared/global-settings-types'

/** The preview's xterm theme, matching the user's terminal appearance. */
export function usePreviewTerminalTheme(settings: GlobalSettings | null): {
  terminalTheme: ITheme | null
  terminalMode: 'dark' | 'light'
} {
  const systemPrefersDark = useSystemPrefersDark()
  const { terminalTheme: composedTheme, terminalMode } = useMemo(() => {
    if (!settings) {
      return { terminalTheme: null, terminalMode: 'dark' as const }
    }
    const appearance = resolveEffectiveTerminalAppearance(settings, systemPrefersDark)
    const theme = composeActiveTerminalTheme(
      appearance.theme ?? getBuiltinTheme(appearance.themeName),
      settings
    )
    return { terminalTheme: theme, terminalMode: appearance.mode }
  }, [settings, systemPrefersDark])
  // Settings arrive as cloned snapshots; compare theme values before reconnecting.
  const retainTheme = useShallow((theme: ITheme | null) => theme)
  return { terminalTheme: retainTheme(composedTheme), terminalMode }
}
