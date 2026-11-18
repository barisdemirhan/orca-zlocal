import { useAgentPickerDraftScope } from '../agent/AgentLaunchSetupButton'
import { agentsOfferedForLaunch } from '@/lib/agent-session/launch/inventory/host-chat-program'
import { worktreeLaunchWorkspace } from '@/lib/agent-session/launch/routing/agent-launch-route-input'
import { useEffect, useRef, useState } from 'react'
import { Loader2, MessageSquarePlus } from 'lucide-react'
import { AgentLaunchPicker } from '@/components/agent/AgentLaunchPicker'
import {
  agentPickerFreshLaunchInputs,
  type AgentPickerDraft,
  type AgentPickerEntry
} from '../../../../shared/agent-launch/picker/agent-launch-picker'
import { useAgentMenuObservation } from '@/components/agent/launch-menu/use-new-tab-agent-menu-rows'
import { useAgentDetectionTargetForWorktree } from '@/hooks/useAgentDetectionTarget'
import type { AgentLaunchSurface } from '@/lib/agent-session/launch/routing/agent-session-launch-plan'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { useTranslate } from '@/i18n/use-translate'
import { getAgentCatalog, getAgentLabel } from '@/lib/agent-catalog/agent-catalog'
import {
  buildAgentSessionContinuationPrompt,
  hasFullAgentSessionContext,
  type AgentSessionContinuationContextMode,
  type AgentSessionContinuationRequest
} from '@/lib/agent-session/context/agent-session-continuation'
import { launchAgentSessionContinuation } from '@/lib/agent-session/launch/continuation/launch-agent-session-continuation'
import { useAppStore } from '@/store'
import { isTuiAgentEnabled } from '../../../../shared/agent-launch/catalog/tui-agent-selection'
import type { TuiAgent } from '../../../../shared/agent-launch/catalog/tui-agent'
import {
  DEFAULT_AGENT_SESSION_CONTINUATION_PLACEMENT,
  type AgentSessionContinuationPlacement
} from '@/lib/agent-session-continuation-placement'
import { AgentSessionContinuationContextField } from './AgentSessionContinuationContextField'
import { AgentSessionContinuationPlacementField } from './AgentSessionContinuationPlacementField'
import {
  chooseInitialContinuationAgent,
  isContinuationAgentAllowed
} from './agent-session-continuation-selection'

type AgentSessionContinuationDialogProps = {
  open: boolean
  request: AgentSessionContinuationRequest | null
  sourceWorkingDirectory?: string
  onOpenChange: (open: boolean) => void
  /** Fires after the new session launched, so a host can step aside for the new tab. */
  onStarted?: () => void
}

const EMPTY_DISABLED_AGENTS: TuiAgent[] = []

export function AgentSessionContinuationDialog({
  open,
  request,
  sourceWorkingDirectory,
  onOpenChange,
  onStarted
}: AgentSessionContinuationDialogProps): React.JSX.Element {
  const t = useTranslate()
  const workspace = request ? worktreeLaunchWorkspace(request.worktreeId) : null
  const abortRef = useRef<AbortController | null>(null)
  const settings = useAppStore((state) => state.settings)
  const [pick, setPick] = useState<{
    request: AgentSessionContinuationRequest | null
    agent: TuiAgent
    surface?: AgentLaunchSurface
    draft?: AgentPickerDraft
    entry?: AgentPickerEntry
  } | null>(null)
  const detectionTarget = useAgentDetectionTargetForWorktree(request?.worktreeId ?? null)
  const [contextPick, setContextPick] = useState<{
    request: AgentSessionContinuationRequest | null
    mode: AgentSessionContinuationContextMode
  } | null>(null)
  const [placementPick, setPlacementPick] = useState<{
    request: AgentSessionContinuationRequest | null
    placement: AgentSessionContinuationPlacement
  } | null>(null)
  // One start's own token: a closed or reopened dialog no longer waits on a start it left behind.
  const [startingFor, setStartingFor] = useState<{
    request: AgentSessionContinuationRequest
  } | null>(null)
  if (!open) {
    if (pick) {
      setPick(null)
    }
    if (contextPick) {
      setContextPick(null)
    }
    if (placementPick) {
      setPlacementPick(null)
    }
    if (startingFor) {
      setStartingFor(null)
    }
  }
  const contextMode = contextPick?.request === request ? contextPick.mode : 'focused'
  const placement =
    placementPick?.request === request
      ? placementPick.placement
      : DEFAULT_AGENT_SESSION_CONTINUATION_PLACEMENT
  const starting = open && startingFor?.request === request
  const [showStarting, setShowStarting] = useState(false)
  const disabledAgents = settings?.disabledTuiAgents ?? EMPTY_DISABLED_AGENTS

  const observation = useAgentMenuObservation(
    workspace ? { workspace, launchCwd: request?.initialCwd } : null,
    open && Boolean(request),
    detectionTarget,
    { wakeOnOpen: true }
  )
  const { detectedIds, detectionFailed } = observation.detection
  const detecting =
    detectedIds === null && !detectionFailed && !observation.detection.needsServerUpdate
  // Agents whose chat opens without their CLI are listed too; their rows decide what is pickable.
  const offered = workspace
    ? agentsOfferedForLaunch(useAppStore.getState(), workspace, detectedIds)
    : []
  const agents = getAgentCatalog().filter(
    (agent) =>
      isTuiAgentEnabled(agent.id, disabledAgents) &&
      isContinuationAgentAllowed(agent.id, request?.source.sourceAgent, request?.avoidSourceAgent)
  )
  const destinationModel =
    observation.model.state === 'settled'
      ? {
          ...observation.model,
          rows: observation.model.rows.filter((row) =>
            agents.some((agent) => agent.id === row.agent)
          )
        }
      : observation.model
  const rows = destinationModel.state === 'settled' ? destinationModel.rows : []
  const pickable = agents
    .map((agent) => agent.id)
    .filter(
      (agent) =>
        offered.includes(agent) &&
        rows.some((row) => row.agent === agent && row.kind !== 'chat-unavailable')
    )
  // Why: the explanation must read the same host rows the picker shows, before the family filter.
  const openableRows =
    observation.model.state === 'settled'
      ? observation.model.rows.filter((row) => row.kind !== 'chat-unavailable')
      : []
  const onlySourceFamilyOffered =
    openableRows.length > 0 &&
    openableRows.every(
      (row) =>
        !isContinuationAgentAllowed(
          row.agent,
          request?.source.sourceAgent,
          request?.avoidSourceAgent
        )
    )
  const preparing = request === null
  const controlsDisabled = preparing || detecting || starting
  const hasFullContext = request ? hasFullAgentSessionContext(request.source) : false

  useEffect(() => {
    const abort = open && request ? new AbortController() : null
    abortRef.current = abort
    return () => abort?.abort()
  }, [open, request])

  const draftScope = useAgentPickerDraftScope(request)
  const currentPick = pick?.request === request && pickable.includes(pick.agent) ? pick : null
  const selectedAgent =
    currentPick?.agent ??
    chooseInitialContinuationAgent({
      availableAgents: pickable,
      automaticAgents: pickable.filter((agent) => detectedIds?.includes(agent)),
      sourceAgent: request?.avoidSourceAgent ? null : (request?.source.sourceAgent ?? null),
      defaultAgent: settings?.defaultTuiAgent
    })
  const selection = observation.selectionFor(selectedAgent, currentPick?.surface)

  useEffect(() => {
    if (!starting) {
      setShowStarting(false)
      return
    }
    // Why: local launches are often instant; defer the spinner so fast paths do not flicker.
    const timer = window.setTimeout(() => setShowStarting(true), 200)
    return () => window.clearTimeout(timer)
  }, [starting])

  const handleStart = async (): Promise<void> => {
    if (
      !request ||
      detecting ||
      !selectedAgent ||
      starting ||
      !selection.ready ||
      !selection.choice
    ) {
      return
    }
    const prompt = buildAgentSessionContinuationPrompt(request.source, contextMode)
    if (!prompt) {
      return
    }
    const start = { request }
    // Aborts when the dialog closes or moves to another request; a sent launch still settles.
    const signal = abortRef.current?.signal
    setStartingFor(start)
    const launched = await launchAgentSessionContinuation({
      agent: selectedAgent,
      prompt,
      worktreeId: request.worktreeId,
      groupId: request.groupId,
      initialCwd: request.initialCwd,
      launchChoice: selection.choice,
      ...(currentPick?.draft
        ? agentPickerFreshLaunchInputs(
            currentPick.draft,
            {
              surface: selection.choice.route === 'terminal-tui' ? 'terminal' : 'chat',
              executionHostId: selection.choice.executionHostId
            },
            currentPick.entry
          )
        : {}),
      launchSource: request.launchSource,
      signal,
      // Why: only a request from a mirror pane offers a placement; everywhere else keeps jumping.
      ...(request.mirrorSource ? { mirror: { ...request.mirrorSource, placement } } : {})
    })
    setStartingFor((current) => (current === start ? null : current))
    // A late finish is reported by the launch's own owners, never by a dialog it no longer holds.
    if (launched && !signal?.aborted) {
      onOpenChange(false)
      onStarted?.()
    }
  }

  const sourceName = request?.source.sourceTitle?.trim()
  const sourceAgentLabel = request?.source.sourceAgent
    ? getAgentLabel(request.source.sourceAgent)
    : null
  const startDisabled =
    controlsDisabled || agents.length === 0 || !selectedAgent || !selection.ready
  const workingDirectory = sourceWorkingDirectory ?? request?.initialCwd

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="min-w-0 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <MessageSquarePlus className="size-4" />
            {t('components.agentSessionContinuation.dialogTitle', 'Hand Off to Another Agent')}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {t(
              'components.agentSessionContinuation.dialogDescription',
              'Start a fresh Agent session from this stopping point. The original session stays unchanged.'
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="min-w-0 space-y-4">
          <div className="min-w-0 rounded-md border border-border bg-muted/30 px-3 py-2">
            <div className="truncate text-xs font-medium">
              {sourceName ||
                t('components.agentSessionContinuation.untitledSession', 'Current session')}
            </div>
            <div className="mt-0.5 min-h-4 text-[11px] text-muted-foreground">
              {sourceAgentLabel
                ? t(
                    'components.agentSessionContinuation.originalAgent',
                    'Original Agent: {{agent}}',
                    { agent: sourceAgentLabel }
                  )
                : null}
            </div>
          </div>

          <div className="min-w-0 space-y-1.5">
            <label className="text-xs font-medium">
              {t('components.agentSessionContinuation.agent', 'Agent')}
            </label>
            <AgentLaunchPicker
              draftScope={draftScope}
              disabled={controlsDisabled}
              model={destinationModel}
              worktreeId={request?.worktreeId}
              agent={selectedAgent}
              cli={selection.cli}
              value={currentPick?.draft}
              onPick={(agent, draft, entry) =>
                setPick({ request, agent, surface: draft?.surface, draft, entry })
              }
            />
            <div className="min-h-4">
              {preparing ? (
                <p className="text-[11px] text-muted-foreground">
                  {t(
                    'components.agentSessionContinuation.preparingContext',
                    'Preparing saved chat context…'
                  )}
                </p>
              ) : detecting ? (
                <p className="text-[11px] text-muted-foreground">
                  {t(
                    'components.agentSessionContinuation.detectingAgents',
                    'Detecting Agents on this workspace host…'
                  )}
                </p>
              ) : detectionFailed ? (
                <p className="text-[11px] text-destructive">
                  {t(
                    'components.agentSessionContinuation.detectionFailed',
                    'Could not detect Agents on this workspace host.'
                  )}
                </p>
              ) : destinationModel.state === 'settled' && rows.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">
                  {onlySourceFamilyOffered && sourceAgentLabel
                    ? t(
                        'components.agentSessionContinuation.onlySourceFamilyDetected',
                        'Only Agents sharing the usage limit with {{agent}} are available on this workspace host. Enable or install a different Agent.',
                        { agent: sourceAgentLabel }
                      )
                    : t(
                        'components.agentSessionContinuation.noAgents',
                        'No enabled Agents were detected on this workspace host.'
                      )}
                </p>
              ) : null}
            </div>
          </div>

          <AgentSessionContinuationContextField
            disabled={controlsDisabled}
            mode={contextMode}
            hasFullContext={hasFullContext}
            preparing={preparing}
            sourceKind={request?.source.sourceKind}
            onPick={(mode) => setContextPick({ request, mode })}
          />

          {request?.mirrorSource ? (
            <AgentSessionContinuationPlacementField
              disabled={controlsDisabled}
              placement={placement}
              onPick={(next) => setPlacementPick({ request, placement: next })}
            />
          ) : null}

          <div className="min-h-4 text-[11px] text-muted-foreground">
            {workingDirectory ? (
              <>
                {t('components.agentSessionContinuation.startsIn', 'Starts in:')}{' '}
                <span className="break-all font-mono text-foreground/80">{workingDirectory}</span>
              </>
            ) : null}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {t('components.native-chat.question.cancel', 'Cancel')}
          </Button>
          <Button
            type="button"
            autoFocus
            disabled={startDisabled}
            onClick={() => void handleStart()}
          >
            {showStarting ? <Loader2 className="size-3.5 animate-spin" /> : null}
            {starting
              ? t('components.agentSessionContinuation.starting', 'Starting…')
              : t('components.agentSessionContinuation.startSession', 'Start New Session')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
