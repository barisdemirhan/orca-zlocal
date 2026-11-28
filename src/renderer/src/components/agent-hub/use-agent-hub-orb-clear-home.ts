import { useCallback, useContext } from 'react'
import { ConfirmationDialogContext } from '@/components/dismiss/confirmation/confirmation-dialog-context'
import { translate } from '@/i18n/i18n'

/** Clearing the Home chat asks first; side chats stay and the old Home chat goes to Earlier. */
export function useAgentHubOrbClearHome(startNew: () => void): () => void {
  const confirm = useContext(ConfirmationDialogContext)
  return useCallback(() => {
    // Why: without the app's dialog host there is nobody to ask, so nothing is cleared.
    void confirm?.({
      title: translate('agentHub.orb.clearHome.title', 'Clear the home chat?'),
      description: translate(
        'agentHub.orb.clearHome.description',
        'Side chats stay open. The current home chat moves to Earlier.'
      ),
      confirmLabel: translate('agentHub.orb.clearHome.action', 'Clear home chat')
    }).then((confirmed) => (confirmed ? startNew() : undefined))
  }, [confirm, startNew])
}
