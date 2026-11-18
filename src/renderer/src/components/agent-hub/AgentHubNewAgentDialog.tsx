import { useMemo, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Settings2 } from 'lucide-react'
import AgentCombobox from '@/components/agent/AgentCombobox'
import ProjectCombobox from '@/components/new-workspace/project-selection/ProjectCombobox'
import { NewWorkspaceComposerFooter } from '@/components/new-workspace/composer/NewWorkspaceComposerFooter'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useAgentDetectionTargetForWorktree } from '@/lib/agent-session/launch/inventory/useAgentDetectionTarget'
import { useDetectedAgents } from '@/lib/agent-session/launch/inventory/useDetectedAgents'
import { translate } from '@/i18n/i18n'
import { getAgentCatalog } from '@/lib/agent-catalog/agent-catalog'
import type { NewWorkspaceProjectOption } from '@/lib/workspace/creation/new-workspace-project-options'
import {
  getScreenSubmitModifierLabel,
  isScreenSubmitShortcut
} from '@/lib/keyboard/screen-submit-shortcut'
import { useAppStore } from '@/store'
import { projectGroupIdFromRepoId } from '../../../../shared/folder-workspaces/folder-workspace-worktree'
import type { TuiAgent } from '../../../../shared/agent-launch/catalog/tui-agent'
import {
  DEFAULT_DISABLED_TUI_AGENTS,
  filterEnabledTuiAgents
} from '../../../../shared/agent-launch/catalog/tui-agent-selection'
import { getWorktreeHostIdentity } from '../../../../shared/worktree/host-qualified-identity'
import type { Worktree } from '../../../../shared/worktree/types'
import { buildAgentHubNewAgentLocations } from './agent-hub-new-agent-locations'
import { AgentHubNewAgentWorkspaceCombobox } from './AgentHubNewAgentWorkspaceCombobox'

type AgentHubNewAgentDialogProps = {
  worktree: Worktree
  /** Preselected agent, e.g. when a failed start reopens the dialog. */
  initialAgent?: TuiAgent | null
  pending: boolean
  onStart: (worktree: Worktree, agent: TuiAgent) => void
  onClose: () => void
  onCloseAutoFocus?: (event: Event) => void
}

export function AgentHubNewAgentDialog(props: AgentHubNewAgentDialogProps): React.JSX.Element {
  return (
    <Dialog open onOpenChange={(open) => !open && props.onClose()}>
      <AgentHubNewAgentDialogBody {...props} />
    </Dialog>
  )
}

function AgentHubNewAgentDialogBody({
  worktree,
  initialAgent = null,
  pending,
  onStart,
  onClose,
  onCloseAutoFocus
}: AgentHubNewAgentDialogProps): React.JSX.Element {
  const contentRef = useRef<HTMLDivElement>(null)
  const submittedRef = useRef(false)
  const [selectedIdentity, setSelectedIdentity] = useState(() => getWorktreeHostIdentity(worktree))
  const [agentOverride, setAgentOverride] = useState<TuiAgent | null>(initialAgent)
  const locations = useAppStore(
    useShallow((state) => ({
      repos: state.repos,
      worktreesByRepo: state.worktreesByRepo,
      projectGroups: state.projectGroups,
      folderWorkspaces: state.folderWorkspaces,
      deleteStateByWorktreeId: state.deleteStateByWorktreeId,
      lastVisitedAtByWorktreeId: state.lastVisitedAtByWorktreeId
    }))
  )
  const projects = useMemo(() => buildAgentHubNewAgentLocations(locations), [locations])
  const project = projects.find((option) =>
    option.worktrees.some((row) => getWorktreeHostIdentity(row) === selectedIdentity)
  )
  const selectedWorktree = project?.worktrees.find(
    (row) => getWorktreeHostIdentity(row) === selectedIdentity
  )
  const projectOptions = useMemo<NewWorkspaceProjectOption[]>(
    () =>
      projects.flatMap<NewWorkspaceProjectOption>((option) => {
        const groupId = projectGroupIdFromRepoId(option.id)
        const group = locations.projectGroups.find((candidate) => candidate.id === groupId)
        if (group) {
          return [
            {
              kind: 'project-group' as const,
              id: option.id,
              projectGroupId: group.id,
              displayName: option.label,
              badgeColor: group.color ?? 'var(--muted-foreground)',
              detail: group.parentPath ?? '',
              parentPath: group.parentPath ?? '',
              connectionId: group.connectionId ?? null
            }
          ]
        }
        const repo = locations.repos.find((candidate) => candidate.id === option.id)
        return repo
          ? [
              {
                kind: 'project' as const,
                id: option.id,
                projectId: repo.id,
                displayName: option.label,
                badgeColor: repo.badgeColor,
                detail: repo.path
              }
            ]
          : []
      }),
    [locations.projectGroups, locations.repos, projects]
  )
  const detectionTarget = useAgentDetectionTargetForWorktree(selectedWorktree?.id ?? null)
  const { detectedIds } = useDetectedAgents(selectedWorktree ? detectionTarget : undefined)
  const defaultAgent = useAppStore((state) => state.settings?.defaultTuiAgent)
  const disabledAgents = useAppStore(
    (state) => state.settings?.disabledTuiAgents ?? DEFAULT_DISABLED_TUI_AGENTS
  )
  const openSettingsTarget = useAppStore((state) => state.openSettingsTarget)
  const openSettingsPage = useAppStore((state) => state.openSettingsPage)
  const enabledIds = new Set(filterEnabledTuiAgents(detectedIds ?? [], disabledAgents))
  const agents = getAgentCatalog().filter((agent) => enabledIds.has(agent.id))
  const preferredAgent =
    agents.find((agent) => agent.id === defaultAgent)?.id ?? agents[0]?.id ?? null
  const selectedAgent =
    agentOverride && enabledIds.has(agentOverride) ? agentOverride : preferredAgent
  if (agentOverride && !enabledIds.has(agentOverride)) {
    setAgentOverride(null)
  }
  const createDisabled = pending || !selectedWorktree || !selectedAgent
  const openAgentSettings = (): void => {
    openSettingsTarget({ pane: 'agents', repoId: null })
    openSettingsPage()
    onClose()
  }
  const submit = (): void => {
    if (createDisabled || submittedRef.current || !selectedWorktree || !selectedAgent) {
      return
    }
    // Recheck live locations so a store update cannot launch a just-removed workspace.
    const current = buildAgentHubNewAgentLocations(useAppStore.getState())
      .flatMap((option) => option.worktrees)
      .find((row) => getWorktreeHostIdentity(row) === selectedIdentity)
    if (!current) {
      return
    }
    submittedRef.current = true
    onStart(current, selectedAgent)
    onClose()
  }
  return (
    <DialogContent
      ref={contentRef}
      className="flex max-h-[calc(100vh-2rem)] flex-col overflow-hidden sm:max-w-lg"
      onEscapeKeyDown={(event) => event.stopPropagation()}
      onCloseAutoFocus={onCloseAutoFocus}
      onOpenAutoFocus={(event) => {
        event.preventDefault()
        contentRef.current?.querySelector<HTMLElement>('[data-agent-combobox-root="true"]')?.focus()
      }}
      onKeyDownCapture={(event) => {
        if (isScreenSubmitShortcut(event)) {
          event.preventDefault()
          event.stopPropagation()
          submit()
        }
      }}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <DialogHeader className="gap-1">
        <DialogTitle className="text-base font-semibold">
          {translate('agentHub.mirror.newAgent', 'New agent')}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {translate(
            'agentHub.mirror.newAgentDescription',
            'Choose an existing workspace and an agent to start.'
          )}
        </DialogDescription>
      </DialogHeader>
      <div className="min-h-0 min-w-0 space-y-4 overflow-y-auto pt-3 pb-1 scrollbar-sleek">
        <div className="min-w-0 space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            {translate('agentHub.mirror.project', 'Project')}
          </label>
          <ProjectCombobox
            options={projectOptions}
            value={project?.id ?? null}
            placeholder={translate('agentHub.mirror.chooseProject', 'Choose project')}
            onValueChange={(id) => {
              const option = projects.find((candidate) => candidate.id === id)
              if (option) {
                setSelectedIdentity(getWorktreeHostIdentity(option.defaultWorktree))
              }
            }}
          />
        </div>
        <div className="min-w-0 space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            {translate('agentHub.mirror.workspace', 'Workspace')}
          </label>
          <AgentHubNewAgentWorkspaceCombobox
            key={project?.id ?? 'no-project'}
            worktrees={project?.worktrees ?? []}
            value={selectedIdentity}
            onValueChange={setSelectedIdentity}
            disabled={pending || !project}
          />
        </div>
        <div className="min-w-0 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <label className="text-xs font-medium text-muted-foreground">
              {translate('agentHub.mirror.agentLabel', 'Agent')}
            </label>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={openAgentSettings}
                  tabIndex={-1}
                  className="size-5 shrink-0"
                  aria-label={translate('agentHub.mirror.openAgentSettings', 'Open agent settings')}
                >
                  <Settings2 className="size-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={6}>
                {translate('agentHub.mirror.configureAgents', 'Configure agents')}
              </TooltipContent>
            </Tooltip>
          </div>
          <AgentCombobox
            agents={agents}
            value={selectedAgent}
            onValueChange={setAgentOverride}
            onOpenManageAgents={openAgentSettings}
            defaultAgent={defaultAgent}
            allowBlankTerminal={false}
            emptyLabel={translate('agentHub.mirror.noAgents', 'No available agents')}
            allowNarrowTrigger
            triggerClassName="h-9 w-full min-w-0 border-input text-sm focus:border-ring focus:ring-[3px] focus:ring-ring/50"
            onTriggerEnter={createDisabled ? undefined : submit}
          />
        </div>
      </div>
      <NewWorkspaceComposerFooter
        createError={null}
        creating={pending}
        createDisabled={createDisabled}
        onCreate={submit}
        primaryActionLabel={translate('agentHub.mirror.startAgent', 'Start agent')}
        submitShortcutModifierLabel={getScreenSubmitModifierLabel()}
      />
    </DialogContent>
  )
}
