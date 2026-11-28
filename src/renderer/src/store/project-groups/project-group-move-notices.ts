import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import type { ExecutionHostId } from '../../../../shared/execution-host/execution-host'

export function notifyProjectGroupOnOtherHost(): void {
  toast.error(
    translate('auto.store.slices.repos.moveToGroupOtherHost', 'Could not move project to group'),
    {
      description: translate(
        'auto.store.slices.repos.moveToGroupOtherHostDesc',
        'The computer this project runs on does not have this group. A project can only join groups saved on its own computer.'
      )
    }
  )
}

/** Why only paired computers: they can drop mid-move, and without a word the project just stays put. */
export function notifyProjectGroupMoveFailed(
  projectHostId: ExecutionHostId,
  error?: unknown
): void {
  if (projectHostId === 'local') {
    return
  }
  const reason = error instanceof Error ? error.message.trim() : ''
  toast.error(
    translate('auto.store.slices.repos.moveToGroupOtherHost', 'Could not move project to group'),
    reason ? { description: reason } : undefined
  )
}

export function notifyProjectGroupHostUnreachable(): void {
  toast.error(
    translate('auto.store.slices.repos.moveToGroupOtherHost', 'Could not move project to group'),
    {
      description: translate(
        'auto.store.slices.repos.moveToGroupHostUnreachable',
        "Orca could not create this group on the project's computer. Try again after reconnecting."
      )
    }
  )
}
