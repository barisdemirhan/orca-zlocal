import type {
  ProviderRateLimits,
  RateLimitState,
  RateLimitWindow
} from '../../../../shared/agent-usage/rate-limits/rate-limit-types'
import { getProviderDisplayName } from '../../../../shared/agent-usage/display/usage-provider-windows'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'

export type AgentHubOrbQuotaWindow = {
  name: string
  remaining: number
  resetsAt: number | null
  resetDescription: string | null
}

/** One provider account on one host, however many agents draw on it. */
export type AgentHubOrbQuotaAlert = {
  id: string
  owner: string
  provider: ProviderRateLimits['provider']
  limits: ProviderRateLimits
  windows: AgentHubOrbQuotaWindow[]
  agents: number
}

const QUOTA_ALERT_REMAINING_PERCENT = 10

/** Multi-provider harnesses need explicit provider evidence; their names never select an account. */
export function agentHubOrbQuotaProvider(
  target: AgentHubPaneTarget
): ProviderRateLimits['provider'] | null {
  const providers: Partial<
    Record<NonNullable<AgentHubPaneTarget['agentType']>, ProviderRateLimits['provider']>
  > = {
    claude: 'claude',
    'claude-agent-teams': 'claude',
    codex: 'codex',
    gemini: 'gemini',
    antigravity: 'antigravity',
    cursor: 'cursor',
    kimi: 'kimi',
    grok: 'grok',
    zcode: 'zcode'
  }
  return target.agentType ? (providers[target.agentType] ?? null) : null
}

function verifiedSnapshot(
  provider: ProviderRateLimits['provider'],
  limits: RateLimitState,
  now: number
): ProviderRateLimits | null {
  if (
    (provider === 'codex' && limits.codexTarget.runtime !== 'host') ||
    (provider === 'claude' && limits.claudeTarget.runtime !== 'host')
  ) {
    return null
  }
  const snapshot = provider === 'opencode-go' ? limits.opencodeGo : limits[provider]
  if (
    !snapshot ||
    snapshot.status !== 'ok' ||
    snapshot.usageMetadata?.unverifiableOwner ||
    snapshot.updatedAt > now + 60_000 ||
    now - snapshot.updatedAt > 5 * 60_000
  ) {
    return null
  }
  return snapshot
}

function lowWindows(snapshot: ProviderRateLimits, now: number): AgentHubOrbQuotaWindow[] {
  const windows: [string, RateLimitWindow | null | undefined][] = [
    ['session', snapshot.session],
    ['weekly', snapshot.weekly],
    ['monthly', snapshot.monthly],
    ['fable', snapshot.fableWeekly],
    ...(snapshot.buckets ?? []).map((bucket): [string, RateLimitWindow] => [bucket.name, bucket])
  ]
  return windows.flatMap(([name, window]) => {
    if (
      !window ||
      !Number.isFinite(window.usedPercent) ||
      window.usedPercent < 0 ||
      window.usedPercent > 100 ||
      (window.resetsAt !== null && window.resetsAt <= now)
    ) {
      return []
    }
    const remaining = 100 - window.usedPercent
    return remaining > QUOTA_ALERT_REMAINING_PERCENT
      ? []
      : [
          {
            name,
            remaining,
            resetsAt: window.resetsAt,
            resetDescription: window.resetDescription
          }
        ]
  })
}

/** Groups agents by the account they draw on, so a shared limit is reported once. */
export function collectAgentHubOrbQuotaAlerts(
  usages: readonly { target: AgentHubPaneTarget; owner: string; limits: RateLimitState | null }[],
  now: number
): AgentHubOrbQuotaAlert[] {
  const alerts = new Map<string, AgentHubOrbQuotaAlert>()
  for (const { target, owner, limits } of usages) {
    const provider = agentHubOrbQuotaProvider(target)
    const snapshot = provider && limits ? verifiedSnapshot(provider, limits, now) : null
    if (!provider || !snapshot) {
      continue
    }
    const id = JSON.stringify(['quota', owner, provider])
    const existing = alerts.get(id)
    if (existing) {
      existing.agents += 1
      continue
    }
    const windows = lowWindows(snapshot, now)
    if (windows.length > 0) {
      alerts.set(id, { id, owner, provider, limits: snapshot, windows, agents: 1 })
    }
  }
  return [...alerts.values()].sort(
    (left, right) =>
      Math.min(...left.windows.map((window) => window.remaining)) -
      Math.min(...right.windows.map((window) => window.remaining))
  )
}

// Model text stays in English and on a fixed clock so it does not churn with the UI locale.
function modelResetTime(resetsAt: number, now: number): string {
  return new Intl.DateTimeFormat('en-GB', {
    ...(resetsAt - now >= 24 * 60 * 60_000 ? { weekday: 'short' } : {}),
    hour: '2-digit',
    minute: '2-digit'
  }).format(resetsAt)
}

/** One model notice per account window; the level, not the exact percent, keys re-delivery. */
export function agentHubOrbQuotaNotices(
  alert: AgentHubOrbQuotaAlert,
  now: number
): { id: string; title: string; text: string }[] {
  const name = getProviderDisplayName(alert.provider)
  return alert.windows.map((window) => {
    const empty = window.remaining <= 0
    const reset =
      window.resetsAt !== null
        ? `, resets ${modelResetTime(window.resetsAt, now)}`
        : window.resetDescription
          ? `, resets ${window.resetDescription}`
          : ''
    const agents = alert.agents === 1 ? '1 agent uses it' : `${alert.agents} agents use it`
    return {
      id: JSON.stringify([alert.id, window.name, window.resetsAt, empty ? 'empty' : 'low']),
      title: name,
      text: `${name} ${window.name} ${empty ? '0% left (limit reached)' : '10% or less left'}${reset}, ${agents}`
    }
  })
}
