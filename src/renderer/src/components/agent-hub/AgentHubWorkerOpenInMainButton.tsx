import { createContext, useContext } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTranslate } from '@/i18n/use-translate'
import type { WorkerDockRowView } from '../native-chat/tools/tasks/dock/WorkerDockRow'

/** Set only around a chat that a mirror shows: opens a dock worker in the main window. */
export const AgentHubWorkerOpenInMainContext = createContext<
  ((row: WorkerDockRowView) => void) | null
>(null)

/** A dock row's way out of the mirror; absent outside a mirror and for rows that open a result. */
export function AgentHubWorkerOpenInMainButton({ row }: { row: WorkerDockRowView }) {
  const openInMain = useContext(AgentHubWorkerOpenInMainContext)
  const t = useTranslate()
  if (!openInMain || row.kind !== 'worker' || row.resultId || row.settlement || row.retired) {
    return null
  }
  const label = t('agentHub.mirror.jumpHint', 'Jump to this terminal in its workspace')
  return (
    <Button
      type="button"
      variant="ghost-on-accent-inset"
      size="icon-xs"
      aria-label={label}
      title={label}
      className="relative z-10 size-5 [@media(pointer:coarse)]:size-7"
      onClick={() => openInMain(row)}
    >
      <ArrowUpRight className="size-3.5" />
    </Button>
  )
}
