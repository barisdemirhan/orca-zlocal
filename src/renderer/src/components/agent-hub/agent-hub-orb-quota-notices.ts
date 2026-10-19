import type {
  ProviderRateLimits,
  RateLimitState,
  RateLimitWindow
} from '../../../../shared/rate-limit-types'
import type { AgentHubPaneTarget } from './agent-hub-pane-target'

export type AgentHubOrbFollowNotice = {
  id: string
  target: AgentHubPaneTarget
  text: string
  kind: 'decision' | 'quota' | 'unverifiable'
}

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

export function agentHubOrbQuotaNotices(
  target: AgentHubPaneTarget,
  owner: string,
  limits: RateLimitState | null,
  now: number
): AgentHubOrbFollowNotice[] {
  const provider = agentHubOrbQuotaProvider(target)
  if (!provider || !limits) {
    return []
  }
  if (
    (provider === 'codex' && limits.codexTarget.runtime !== 'host') ||
    (provider === 'claude' && limits.claudeTarget.runtime !== 'host')
  ) {
    return []
  }
  const snapshot = provider === 'opencode-go' ? limits.opencodeGo : limits[provider]
  if (
    !snapshot ||
    snapshot.status !== 'ok' ||
    snapshot.usageMetadata?.unverifiableOwner ||
    snapshot.updatedAt > now + 60_000 ||
    now - snapshot.updatedAt > 5 * 60_000
  ) {
    return []
  }
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
    const level = remaining <= 5 ? 5 : remaining <= 10 ? 10 : remaining <= 20 ? 20 : null
    return level === null
      ? []
      : [
          {
            id: JSON.stringify(['quota', owner, provider, name, window.resetsAt, level]),
            target,
            kind: 'quota' as const,
            text: `${provider} • ${name}: host account usage reports ${Math.round(remaining)}% remaining. Shared account pool; the selected agent's exact account is unverified. Consider finishing the current step before starting more work.`
          }
        ]
  })
}
