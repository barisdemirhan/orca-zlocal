import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'

/** Renames a tab, as double-clicking a mirror's title does; empty restores the name. */
export function AgentHubRenameDialog({
  tabId,
  title,
  heading,
  onOpenChange
}: {
  tabId: string
  title: string
  heading: string
  onOpenChange: (open: boolean) => void
}): React.JSX.Element {
  const setTabCustomTitle = useAppStore((s) => s.setTabCustomTitle)
  const [draft, setDraft] = useState(title)
  const save = (): void => {
    const next = draft.trim()
    if (next !== title) {
      setTabCustomTitle(tabId, next || null)
    }
    onOpenChange(false)
  }
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-sm"
        onEscapeKeyDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle>{heading}</DialogTitle>
        </DialogHeader>
        <Input
          value={draft}
          autoFocus
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              save()
            }
          }}
          aria-label={heading}
        />
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {translate('agentHub.rowMenu.renameCancel', 'Cancel')}
          </Button>
          <Button onClick={save}>{translate('agentHub.rowMenu.renameSave', 'Rename')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
