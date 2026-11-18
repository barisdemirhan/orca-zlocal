import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/class-names'
import type { GlobalSettings } from '../../../../shared/settings/global-settings-types'
import {
  AGENT_HUB_ORB_DEFAULT_NAME,
  AGENT_HUB_ORB_NAME_MAX_LENGTH,
  AGENT_HUB_ORB_TINTS,
  agentHubOrbSoulText,
  normalizeAgentHubOrbName,
  normalizeAgentHubOrbTint,
  normalizeAgentHubOrbTone,
  type AgentHubOrbTint,
  type AgentHubOrbTone
} from '../../../../shared/agent-hub-orb-identity'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Textarea } from '../ui/textarea'
import {
  SettingsRow,
  SettingsSegmentedControl
} from '../settings/form-controls/SettingsFormControls'
import { openAgentHubOrb } from './agent-hub-orb-open'
import { useAgentHubOrbPanel } from './agent-hub-orb-panel-store'
import { useAgentHubOrbIdentityFiles } from './use-agent-hub-orb-identity-files'

const TINT_SWATCH: Record<AgentHubOrbTint, string> = {
  silver: 'bg-muted-foreground',
  teal: 'bg-teal-500',
  emerald: 'bg-emerald-500',
  violet: 'bg-violet-500',
  rose: 'bg-rose-500'
}

function toneLabel(tone: AgentHubOrbTone): string {
  switch (tone) {
    case 'calm':
      return translate('agentHub.orb.identity.toneCalm', 'Calm')
    case 'brief':
      return translate('agentHub.orb.identity.toneBrief', 'Brief')
    case 'warm':
      return translate('agentHub.orb.identity.toneWarm', 'Warm')
    case 'mentor':
      return translate('agentHub.orb.identity.toneMentor', 'Mentor')
    case 'custom':
      return translate('agentHub.orb.identity.toneCustom', 'Custom')
  }
}

function tintLabel(tint: AgentHubOrbTint): string {
  switch (tint) {
    case 'silver':
      return translate('agentHub.orb.identity.tintSilver', 'Silver')
    case 'teal':
      return translate('agentHub.orb.identity.tintTeal', 'Teal')
    case 'emerald':
      return translate('agentHub.orb.identity.tintEmerald', 'Emerald')
    case 'violet':
      return translate('agentHub.orb.identity.tintViolet', 'Violet')
    case 'rose':
      return translate('agentHub.orb.identity.tintRose', 'Rose')
  }
}

export function AgentHubSettingsOrbIdentity({
  settings,
  updateSettings
}: {
  settings: GlobalSettings
  updateSettings: (updates: Partial<GlobalSettings>) => void
}): React.JSX.Element {
  const name = normalizeAgentHubOrbName(settings.agentHubOrbName)
  const tone = normalizeAgentHubOrbTone(settings.agentHubOrbTone)
  const tint = normalizeAgentHubOrbTint(settings.agentHubOrbTint)
  const { files, writeSoul, writeUser } = useAgentHubOrbIdentityFiles()
  const hasConversation = useAgentHubOrbPanel((state) => state.session !== null)
  const [changed, setChanged] = useState(false)
  const [nameDraft, setNameDraft] = useState(settings.agentHubOrbName ?? '')
  const [soulDraft, setSoulDraft] = useState<string | null>(null)
  const [userDraft, setUserDraft] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const soul = soulDraft ?? files?.soul ?? ''
  const user = userDraft ?? files?.user ?? ''

  useEffect(() => {
    setNameDraft(settings.agentHubOrbName ?? '')
  }, [settings.agentHubOrbName])

  const report = (): void => {
    toast.error(translate('agentHub.orb.identity.saveFailed', 'Could not save. Try again.'))
  }
  const commitName = (): void => {
    const next = normalizeAgentHubOrbName(nameDraft)
    setNameDraft(nameDraft.trim())
    if (next === name) {
      return
    }
    updateSettings({ agentHubOrbName: next })
    setChanged(true)
    if (tone !== 'custom') {
      writeSoul(agentHubOrbSoulText(next, tone)).then(() => setSoulDraft(null), report)
    }
  }
  const pickTone = (next: AgentHubOrbTone): void => {
    updateSettings({ agentHubOrbTone: next })
    setChanged(true)
    if (next !== 'custom') {
      writeSoul(agentHubOrbSoulText(name, next)).then(() => setSoulDraft(null), report)
    }
  }
  const commitSoul = (): void => {
    if (soulDraft === null || soulDraft === files?.soul) {
      setSoulDraft(null)
      return
    }
    setChanged(true)
    writeSoul(soulDraft).then(() => setSoulDraft(null), report)
  }
  const commitUser = (): void => {
    if (userDraft === null || userDraft === files?.user) {
      setUserDraft(null)
      return
    }
    setChanged(true)
    writeUser(userDraft).then(() => setUserDraft(null), report)
  }
  const startNew = async (): Promise<void> => {
    setStarting(true)
    try {
      await window.api.agentHub.orb.close()
      await openAgentHubOrb(undefined, true)
      setChanged(false)
    } catch {
      toast.error(translate('auto.agentHub.orb.openFailed', 'Could not open Orb. Try again.'))
    } finally {
      setStarting(false)
    }
  }

  const nameLabel = translate('agentHub.orb.identity.name', 'Name')
  const toneText = translate('agentHub.orb.identity.tone', 'Tone')
  const tintText = translate('agentHub.orb.identity.tint', 'Colour')
  const soulLabel = translate('agentHub.orb.identity.soul', 'Personality')
  const userLabel = translate('agentHub.orb.identity.user', 'About me')
  return (
    <>
      {changed && hasConversation ? (
        <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <span>
            {translate(
              'agentHub.orb.identity.changedNotice',
              'Identity changed. The open conversation keeps the old one; a new conversation reads the new one.'
            )}
          </span>
          <Button
            type="button"
            variant="outline"
            size="xs"
            disabled={starting}
            onClick={() => void startNew()}
          >
            {translate('agentHub.orb.identity.startNew', 'Start new conversation')}
          </Button>
        </div>
      ) : null}
      <SettingsRow
        label={nameLabel}
        description={translate(
          'agentHub.orb.identity.nameHint',
          'What it calls itself and how it appears in the Orb.'
        )}
        control={
          <Input
            aria-label={nameLabel}
            className="w-44"
            maxLength={AGENT_HUB_ORB_NAME_MAX_LENGTH}
            value={nameDraft}
            placeholder={AGENT_HUB_ORB_DEFAULT_NAME}
            onChange={(event) => setNameDraft(event.target.value)}
            onBlur={commitName}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                event.currentTarget.blur()
              }
            }}
          />
        }
      />
      <SettingsRow
        className="flex-col items-stretch @xl:flex-row @xl:items-center"
        label={toneText}
        control={
          <SettingsSegmentedControl
            value={tone}
            ariaLabel={toneText}
            wrap
            onChange={pickTone}
            options={(['calm', 'brief', 'warm', 'mentor', 'custom'] as const).map((value) => ({
              value,
              label: toneLabel(value)
            }))}
          />
        }
      />
      <SettingsRow
        label={tintText}
        control={
          <div role="radiogroup" aria-label={tintText} className="flex items-center gap-2">
            {AGENT_HUB_ORB_TINTS.map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={tint === value}
                aria-label={tintLabel(value)}
                title={tintLabel(value)}
                className={cn(
                  'size-5 cursor-pointer rounded-full outline-none ring-offset-2 ring-offset-background focus-visible:ring-2 focus-visible:ring-ring',
                  TINT_SWATCH[value],
                  tint === value && 'ring-2 ring-foreground'
                )}
                onClick={() => updateSettings({ agentHubOrbTint: value })}
              />
            ))}
          </div>
        }
      />
      <div className="space-y-1.5 py-2">
        <label className="text-sm font-medium" htmlFor="agent-hub-orb-soul">
          {soulLabel}
        </label>
        <Textarea
          id="agent-hub-orb-soul"
          className="min-h-28"
          value={soul}
          onChange={(event) => {
            setSoulDraft(event.target.value)
            if (tone !== 'custom') {
              updateSettings({ agentHubOrbTone: 'custom' })
            }
          }}
          onBlur={commitSoul}
        />
      </div>
      <div className="space-y-1.5 py-2">
        <label className="text-sm font-medium" htmlFor="agent-hub-orb-user">
          {userLabel}
        </label>
        <Textarea
          id="agent-hub-orb-user"
          className="min-h-20"
          value={user}
          placeholder={translate(
            'agentHub.orb.identity.userPlaceholder',
            'Your role, preferences, how you like to work.'
          )}
          onChange={(event) => setUserDraft(event.target.value)}
          onBlur={commitUser}
        />
      </div>
    </>
  )
}
