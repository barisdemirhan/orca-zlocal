import { useEffect, useMemo, useState } from 'react'
import { FileText } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { readBotHomeDir } from '../settings/bots/bot-home-files'
import { openBotHomeFileTab } from '../settings/bots/bot-home-file-open'
import { useBotHome } from '../settings/bots/use-bot-home-file'
import type { Bot } from '../../../../shared/bot-types'
import type { DirEntry } from '../../../../shared/file-listing/directory-entry'

/** The top-level files of the bot's home folder; one opens in the bot's own workspace. */
export function AgentHubBotPageFiles({
  bot,
  onNavigate
}: {
  bot: Bot
  onNavigate: () => void
}): React.JSX.Element {
  const home = useBotHome(bot)
  const [entries, setEntries] = useState<readonly DirEntry[] | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    if (!home) {
      return undefined
    }
    let live = true
    readBotHomeDir(home, '')
      .then((read) => live && setEntries(read))
      .catch(() => live && setFailed(true))
    return () => {
      live = false
    }
  }, [home])
  const files = useMemo(
    () =>
      (entries ?? [])
        .filter((entry) => !entry.isDirectory)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [entries]
  )
  if (failed) {
    return <Note>{translate('agentHub.bots.page.filesFailed', 'Couldn’t read the folder')}</Note>
  }
  if (!entries || !home) {
    return <Note>{translate('agentHub.bots.page.filesLoading', 'Reading the folder…')}</Note>
  }
  if (files.length === 0) {
    return <Note>{translate('agentHub.bots.page.filesEmpty', 'No files in this folder')}</Note>
  }
  return (
    <div className="flex flex-col">
      {files.map((file) => (
        <button
          key={file.name}
          type="button"
          tabIndex={-1}
          onClick={() => {
            openBotHomeFileTab(bot, home, file.name)
            onNavigate()
          }}
          className="flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-foreground hover:bg-foreground/[0.05]"
        >
          <FileText aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate">{file.name}</span>
        </button>
      ))}
    </div>
  )
}

function Note({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <div className="px-2 py-6 text-center text-xs text-muted-foreground">{children}</div>
}
