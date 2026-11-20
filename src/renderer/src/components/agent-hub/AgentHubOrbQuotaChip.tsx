import { Gauge } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { getIntlLocale, translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { normalizeUsagePercentageDisplay } from '../../../../shared/agent-usage/display/usage-percentage-display'
import { ProviderPanel } from '../status-bar/usage/provider-usage-panel'
import { getProviderDisplayName } from '../../../../shared/agent-usage/display/usage-provider-windows'
import { useAgentHubOrbAwarenessStore } from './agent-hub-orb-awareness-store'
import type { AgentHubOrbQuotaAlert } from './agent-hub-orb-quota-notices'

function resetTime(resetsAt: number): string {
  const sameDay = new Date(resetsAt).toDateString() === new Date().toDateString()
  return new Date(resetsAt).toLocaleString(getIntlLocale(), {
    ...(sameDay ? {} : { weekday: 'short' }),
    hour: '2-digit',
    minute: '2-digit'
  })
}

function chipLabel(alert: AgentHubOrbQuotaAlert): string {
  const tightest = alert.windows.reduce((left, right) =>
    right.remaining < left.remaining ? right : left
  )
  if (tightest.remaining > 0) {
    return translate('agentHub.orb.quota.low', '{{provider}} {{percent}}%', {
      provider: getProviderDisplayName(alert.provider),
      percent: Math.round(tightest.remaining)
    })
  }
  const reset =
    tightest.resetsAt !== null ? resetTime(tightest.resetsAt) : tightest.resetDescription
  return reset
    ? translate('agentHub.orb.quota.limitUntil', 'Limit · {{time}}', { time: reset })
    : translate('agentHub.orb.quota.limit', 'Limit')
}

/** One header chip for every nearly used-up account; it explains the limit and opens no agent. */
export function AgentHubOrbQuotaChip(): React.JSX.Element | null {
  const quota = useAgentHubOrbAwarenessStore((s) => s.quota)
  const environments = useAppStore((s) => s.runtimeEnvironments)
  const display = normalizeUsagePercentageDisplay(useAppStore((s) => s.usagePercentageDisplay))
  const lead = quota[0]
  if (!lead) {
    return null
  }
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="warning-chip"
          size="xs"
          aria-label={translate('agentHub.orb.quota.show', 'Show usage limits')}
          className="min-w-0 shrink"
        >
          <Gauge />
          <span className="truncate">{chipLabel(lead)}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72">
        <div className="divide-y divide-border">
          {quota.map((alert) => (
            <section key={alert.id} className="space-y-2 py-3 first:pt-0 last:pb-0">
              <ProviderPanel
                p={alert.limits}
                showResetCredits={false}
                usagePercentageDisplay={display}
              />
              <p className="text-xs text-muted-foreground">
                {alert.owner === 'local'
                  ? translate('agentHub.orb.quota.thisComputer', 'This computer')
                  : (environments.find((environment) => environment.id === alert.owner)?.name ??
                    alert.owner)}
                {' · '}
                {alert.agents === 1
                  ? translate('agentHub.orb.quota.agentsOne', '1 agent uses this account')
                  : translate(
                      'agentHub.orb.quota.agentsMany',
                      '{{count}} agents use this account',
                      {
                        count: alert.agents
                      }
                    )}
              </p>
            </section>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
