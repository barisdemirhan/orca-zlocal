import { useEffect } from 'react'
import { toast } from 'sonner'
import type { AgentSessionPluginToast } from '../../../../../../shared/agent-session/plugin-surfaces/agent-session-plugin-surface-wire'

const MIN_TOAST_MS = 1000
const MAX_TOAST_MS = 15_000
const REMEMBERED_TOAST_IDS = 200

// Module-wide so a remount or reconnect of any view never shows a toast twice.
const shownToastIds = new Set<string>()

export function useAgentSessionPluginToasts(
  toasts: readonly AgentSessionPluginToast[] | undefined
): void {
  useEffect(() => {
    for (const item of toasts ?? []) {
      if (shownToastIds.has(item.id)) {
        continue
      }
      shownToastIds.add(item.id)
      if (shownToastIds.size > REMEMBERED_TOAST_IDS) {
        shownToastIds.delete(shownToastIds.values().next().value as string)
      }
      toast(item.plugin, {
        id: item.id,
        description: item.text,
        duration: Math.min(MAX_TOAST_MS, Math.max(MIN_TOAST_MS, item.timeoutMs))
      })
    }
  }, [toasts])
}
