import { PictureInPicture2 } from 'lucide-react'
import { useTranslate } from '@/i18n/use-translate'
import { Button } from '../ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'
import { AgentHubShortcut } from './AgentHubShortcut'

/** A sidebar row's hover Pop out; `revealClassName` names the row's own hover group. */
export function AgentHubPopOutButton({
  revealClassName,
  variant = 'ghost',
  withShortcut = false,
  onPopOut
}: {
  revealClassName: string
  /** `ghost-on-accent` on a row whose hover fill is the accent. */
  variant?: 'ghost' | 'ghost-on-accent'
  /** The hub's Pop out shortcut, which acts on this row's terminal. */
  withShortcut?: boolean
  onPopOut: () => void
}): React.JSX.Element {
  const t = useTranslate()
  const label = t('agentHub.row.popOut', 'Pop out')
  return (
    <span className={revealClassName}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={variant}
            size="icon-xs"
            aria-label={label}
            data-agent-hub-sidebar-popout
            className="shrink-0"
            onPointerDown={(event) => event.stopPropagation()}
            onDoubleClick={(event) => event.stopPropagation()}
            // The row opens on Enter too; the key belongs to this button.
            onKeyDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation()
              onPopOut()
            }}
          >
            <PictureInPicture2 className="size-3" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={4}>
          <span className="flex items-center gap-2">
            {label}
            {withShortcut ? <AgentHubShortcut actionId="agentHub.popOut" /> : null}
          </span>
        </TooltipContent>
      </Tooltip>
    </span>
  )
}
