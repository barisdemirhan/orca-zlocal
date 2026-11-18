import { useTranslate } from '@/i18n/use-translate'
import type { GlobalSettings } from '../../../../../../shared/settings/global-settings-types'
import { BROWSER_CLIENT_HOSTED_REMOTE_SETTINGS_TARGET_ID } from '@/components/settings/navigation/settings-navigation-types'
import { SearchableSetting } from '../../section-layout/SearchableSetting'
import { SettingsRow, SettingsSegmentedControl } from '../../form-controls/SettingsFormControls'
import {
  getBrowserClientHostedRemoteDescription,
  getBrowserClientHostedRemoteOptions,
  getBrowserClientHostedRemoteTitle
} from './browser-client-hosted-remote-copy'

type BrowserClientHostedRemoteSettingProps = {
  settings: Pick<GlobalSettings, 'browserClientHostedRemoteEnabled'>
  updateSettings: (updates: Partial<GlobalSettings>) => void
}

export function BrowserClientHostedRemoteSetting({
  settings,
  updateSettings
}: BrowserClientHostedRemoteSettingProps): React.JSX.Element {
  const t = useTranslate()
  const title = getBrowserClientHostedRemoteTitle(t)
  const description = getBrowserClientHostedRemoteDescription(t)

  return (
    <SearchableSetting
      id={BROWSER_CLIENT_HOSTED_REMOTE_SETTINGS_TARGET_ID}
      title={title}
      description={description}
      keywords={[
        'browser',
        'remote',
        'client',
        'host',
        'hosted',
        'desktop',
        'webview',
        'placement',
        'render',
        'stream'
      ]}
    >
      <SettingsRow
        label={title}
        description={description}
        control={
          <SettingsSegmentedControl
            size="sm"
            ariaLabel={title}
            // Older profiles omit the flag and default to client hosting.
            value={settings.browserClientHostedRemoteEnabled !== false ? 'device' : 'server'}
            onChange={(value) =>
              updateSettings({ browserClientHostedRemoteEnabled: value === 'device' })
            }
            options={getBrowserClientHostedRemoteOptions(t)}
          />
        }
      />
    </SearchableSetting>
  )
}
