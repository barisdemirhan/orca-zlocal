import { translate } from '@/i18n/i18n'

export function getBrowserClientHostedRemoteTitle(): string {
  return translate('settings.browser.clientHostedRemote.rowTitle', 'Remote server workspaces')
}

// New pages only: placement is fixed per page generation, so live pages are never migrated.
export function getBrowserClientHostedRemoteDescription(): string {
  return translate(
    'settings.browser.clientHostedRemote.rowDescription',
    'Where pages render. Traffic always goes through the remote server. Applies to new pages only.'
  )
}

export type BrowserClientHostedRemoteChoice = 'device' | 'server'

export function getBrowserClientHostedRemoteOptions(): {
  value: BrowserClientHostedRemoteChoice
  label: string
  tooltip: string
}[] {
  return [
    {
      value: 'device',
      label: translate('settings.browser.clientHostedRemote.optionDevice', 'This device'),
      tooltip: translate(
        'settings.browser.clientHostedRemote.optionDeviceTooltip',
        'Pages render on this desktop, so input and popups behave natively.'
      )
    },
    {
      value: 'server',
      label: translate('settings.browser.clientHostedRemote.optionServer', 'Server (streamed)'),
      tooltip: translate(
        'settings.browser.clientHostedRemote.optionServerTooltip',
        'Pages render on the remote server and stream to this device.'
      )
    }
  ]
}
