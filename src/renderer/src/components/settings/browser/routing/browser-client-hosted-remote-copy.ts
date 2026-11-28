import { translate } from '@/i18n/i18n'
import type { Translate } from '@/i18n/use-translate'

export function getBrowserClientHostedRemoteTitle(t: Translate = translate): string {
  return t('settings.browser.clientHostedRemote.rowTitle', 'Remote server workspaces')
}

// New pages only: placement is fixed per page generation, so live pages are never migrated.
export function getBrowserClientHostedRemoteDescription(t: Translate = translate): string {
  return t(
    'settings.browser.clientHostedRemote.rowDescription',
    'Where pages render. Traffic always goes through the remote server. Applies to new pages only.'
  )
}

export type BrowserClientHostedRemoteChoice = 'device' | 'server'

export function getBrowserClientHostedRemoteOptions(t: Translate = translate): {
  value: BrowserClientHostedRemoteChoice
  label: string
  tooltip: string
}[] {
  return [
    {
      value: 'device',
      label: t('settings.browser.clientHostedRemote.optionDevice', 'This device'),
      tooltip: t(
        'settings.browser.clientHostedRemote.optionDeviceTooltip',
        'Pages render on this desktop, so input and popups behave natively.'
      )
    },
    {
      value: 'server',
      label: t('settings.browser.clientHostedRemote.optionServer', 'Server (streamed)'),
      tooltip: t(
        'settings.browser.clientHostedRemote.optionServerTooltip',
        'Pages render on the remote server and stream to this device.'
      )
    }
  ]
}
