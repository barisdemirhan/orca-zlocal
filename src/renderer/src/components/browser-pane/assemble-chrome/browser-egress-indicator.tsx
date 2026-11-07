import { useState } from 'react'
import { Globe, Monitor, Server } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { SettingsSegmentedControl } from '@/components/settings/form-controls/SettingsFormControls'
import {
  getBrowserClientHostedRemoteOptions,
  type BrowserClientHostedRemoteChoice
} from '@/components/settings/browser/routing/browser-client-hosted-remote-copy'
import { switchBrowserPageChannel } from '../browser-page-channel-switch'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  BROWSER_CLIENT_HOSTED_REMOTE_SETTINGS_TARGET_ID,
  BROWSER_SSH_WORKSPACE_ROUTING_SETTINGS_TARGET_ID
} from '@/lib/settings-navigation-types'
import {
  toRuntimeExecutionHostId,
  toSshExecutionHostId
} from '../../../../../shared/execution-host'
import { getHostSettingOverride } from '../../../../../shared/host-setting-overrides'
import { getExecutionHostIdForWorktree } from '@/lib/workspace/ownership/worktree-runtime-owner'
import { resolveSshWorkspaceBrowserRouteEligibility } from '@/lib/browser/workspace/ssh-workspace-browser-route-eligibility'

/** Use the shared globe slot to expose egress location because local and remotely routed pages otherwise look identical. */
function EgressIndicatorButton({
  icon,
  egress,
  description,
  detail,
  settingsSectionId,
  renderControls
}: {
  icon: React.ReactNode
  egress: 'ssh' | 'local' | 'remote'
  description: string
  detail: string
  settingsSectionId: string
  renderControls?: (close: () => void) => React.ReactNode
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const openSettingsTarget = useAppStore((s) => s.openSettingsTarget)
  const openSettingsPage = useAppStore((s) => s.openSettingsPage)
  return (
    <Popover modal={false} open={open} onOpenChange={setOpen}>
      {/* Why: suppress the hover tooltip while the popover is open — both anchor below the icon and would overlap. */}
      <Tooltip open={open ? false : undefined}>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
              aria-label={description}
              data-testid="ssh-egress-indicator"
              data-egress={egress}
              // Why: the address bar form focuses its input on any click inside it.
              onClick={(event) => event.stopPropagation()}
            >
              {icon}
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={8}>
          {description}
        </TooltipContent>
      </Tooltip>
      <PopoverContent
        side="bottom"
        align="start"
        sideOffset={8}
        className="w-72 p-3"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="text-sm font-medium text-foreground">{description}</div>
        <div className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</div>
        {renderControls?.(() => setOpen(false))}
        <Button
          type="button"
          variant="link"
          size="xs"
          className="mt-1.5 h-auto px-0"
          data-testid="ssh-egress-indicator-settings"
          onClick={() => {
            setOpen(false)
            openSettingsTarget({
              pane: 'browser',
              repoId: null,
              sectionId: settingsSectionId
            })
            openSettingsPage()
          }}
        >
          {translate('browser.sshEgress.settingsLink', 'Routing settings')}
        </Button>
      </PopoverContent>
    </Popover>
  )
}

/** Local browser pages in an SSH workspace: routed through the host, or opted out. */
export function SshEgressIndicator({
  worktreeId
}: {
  worktreeId: string
}): React.JSX.Element | null {
  const executionHostId = useAppStore((s) => getExecutionHostIdForWorktree(s, worktreeId))
  const sshTargetLabels = useAppStore((s) => s.sshTargetLabels)
  const settings = useAppStore((s) => s.settings)
  const routeEligibility = resolveSshWorkspaceBrowserRouteEligibility(executionHostId, settings)
  if (!routeEligibility) {
    return <Globe className="size-4 shrink-0 text-muted-foreground" />
  }
  const { targetId, eligible: routed } = routeEligibility
  const hostLabel =
    getHostSettingOverride(settings, toSshExecutionHostId(targetId), 'displayLabel') ??
    sshTargetLabels.get(targetId) ??
    targetId
  return (
    <EgressIndicatorButton
      icon={routed ? <Server className="size-4" /> : <Monitor className="size-4" />}
      egress={routed ? 'ssh' : 'local'}
      description={
        routed
          ? translate('browser.sshEgress.routedTooltip', 'Browsing through {{value0}}', {
              value0: hostLabel
            })
          : translate(
              'browser.sshEgress.localTooltip',
              'Browsing from this device, not {{value0}}',
              {
                value0: hostLabel
              }
            )
      }
      detail={
        routed
          ? translate(
              'browser.sshEgress.routedDetail',
              "Network traffic and DNS go through the workspace's SSH host."
            )
          : translate(
              'browser.sshEgress.localDetail',
              'Pages load from this machine and its network.'
            )
      }
      settingsSectionId={BROWSER_SSH_WORKSPACE_ROUTING_SETTINGS_TARGET_ID}
    />
  )
}

/** Remote-runtime browser pages: client-hosted (renders here) or streamed from the host. */
export function RemoteRuntimeEgressIndicator({
  runtimeEnvironmentId,
  presentation,
  page
}: {
  runtimeEnvironmentId: string
  presentation: 'client-hosted' | 'streamed'
  /** The page this address bar belongs to, so the popover can move it to the other channel. */
  page?: { id: string; worktreeId: string; url: string | null }
}): React.JSX.Element {
  const settings = useAppStore((s) => s.settings)
  const environmentName = useAppStore(
    (s) =>
      s.runtimeEnvironments.find((environment) => environment.id === runtimeEnvironmentId)?.name
  )
  const hostLabel =
    getHostSettingOverride(
      settings,
      toRuntimeExecutionHostId(runtimeEnvironmentId),
      'displayLabel'
    ) ??
    environmentName ??
    runtimeEnvironmentId
  const clientHosted = presentation === 'client-hosted'
  return (
    <EgressIndicatorButton
      icon={<Server className="size-4" />}
      egress="remote"
      description={
        clientHosted
          ? translate('browser.remoteEgress.clientHostedTooltip', 'Browsing through {{value0}}', {
              value0: hostLabel
            })
          : translate('browser.remoteEgress.streamedTooltip', 'Browsing on {{value0}}', {
              value0: hostLabel
            })
      }
      detail={
        clientHosted
          ? translate(
              'browser.remoteEgress.clientHostedDetail',
              'The page renders on this device. Network traffic and DNS go through the remote host.'
            )
          : translate(
              'browser.remoteEgress.streamedDetail',
              'The page runs on the remote host and streams to this device.'
            )
      }
      settingsSectionId={BROWSER_CLIENT_HOSTED_REMOTE_SETTINGS_TARGET_ID}
      renderControls={(close) => (
        <RemoteBrowserChannelControls
          runtimeEnvironmentId={runtimeEnvironmentId}
          hostLabel={hostLabel}
          pageChannel={clientHosted ? 'device' : 'server'}
          page={page}
          onMoved={close}
        />
      )}
    />
  )
}

/** Where new pages render, and a way to move this page when it sits on the other side. */
function RemoteBrowserChannelControls({
  runtimeEnvironmentId,
  hostLabel,
  pageChannel,
  page,
  onMoved
}: {
  runtimeEnvironmentId: string
  hostLabel: string
  pageChannel: BrowserClientHostedRemoteChoice
  page: { id: string; worktreeId: string; url: string | null } | undefined
  onMoved: () => void
}): React.JSX.Element {
  const choice: BrowserClientHostedRemoteChoice = useAppStore((s) =>
    s.settings?.browserClientHostedRemoteEnabled === false ? 'server' : 'device'
  )
  const updateSettings = useAppStore((s) => s.updateSettings)
  const [moving, setMoving] = useState(false)
  const label = translate('browser.remoteEgress.channelLabel', 'Open new pages on')
  return (
    <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <SettingsSegmentedControl
        size="sm"
        equalWidth
        ariaLabel={label}
        value={choice}
        onChange={(value) => {
          void updateSettings({ browserClientHostedRemoteEnabled: value === 'device' })
        }}
        options={getBrowserClientHostedRemoteOptions()}
      />
      {page && pageChannel !== choice ? (
        <Button
          type="button"
          size="xs"
          variant="secondary"
          className="self-start"
          disabled={moving}
          data-testid="remote-egress-move-page"
          title={translate(
            'browser.remoteEgress.moveCaveat',
            'Opens a new page at this page’s last address and closes this one. Signed-in and other transient page state may differ.'
          )}
          onClick={() => {
            setMoving(true)
            void switchBrowserPageChannel({
              environmentId: runtimeEnvironmentId,
              worktreeId: page.worktreeId,
              pageId: page.id,
              lastCommittedUrl: page.url,
              channel: choice
            })
              .then((moved) => {
                if (moved) {
                  onMoved()
                } else {
                  toast.error(
                    translate(
                      'browser.remoteEgress.moveFailed',
                      "Couldn't reopen this page. Check the connection and try again."
                    )
                  )
                }
              })
              .catch((error: unknown) => {
                toast.error(error instanceof Error ? error.message : String(error))
              })
              .finally(() => setMoving(false))
          }}
        >
          {choice === 'device'
            ? translate('browser.remoteEgress.moveHere', 'Reopen this page here')
            : translate('browser.remoteEgress.moveToHost', 'Reopen this page on {{value0}}', {
                value0: hostLabel
              })}
        </Button>
      ) : null}
    </div>
  )
}
