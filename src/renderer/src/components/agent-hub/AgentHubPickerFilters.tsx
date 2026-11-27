import { Button } from '@/components/ui/button'
import { useTranslate } from '@/i18n/use-translate'
import { BotAvatar } from '../bots/BotAvatar'
import type { AgentHubPickerBot } from './agent-hub-picker-bot-filter'
import type { AgentHubPickerProject } from './agent-hub-picker-project-filter'
import { AgentHubPickerChipFilter } from './AgentHubPickerChipFilter'

/** The picker's filter row: project chips, bot chips (when any row has a bot) and one clear button. */
export function AgentHubPickerFilters({
  projects,
  bots,
  selectedProjects,
  selectedBots,
  onProjectsChange,
  onBotsChange,
  onClear,
  onClosed
}: {
  projects: readonly AgentHubPickerProject[]
  bots: readonly AgentHubPickerBot[]
  selectedProjects: ReadonlySet<string>
  selectedBots: ReadonlySet<string>
  onProjectsChange: (next: ReadonlySet<string>) => void
  onBotsChange: (next: ReadonlySet<string>) => void
  onClear: () => void
  onClosed: () => void
}): React.JSX.Element {
  const t = useTranslate()
  return (
    <div className="flex flex-wrap items-center gap-1 text-xs">
      <AgentHubPickerChipFilter
        id="project"
        items={projects.map((project) => ({
          key: project.key,
          label: project.label,
          secondaryLabel: project.hostLabel
        }))}
        selected={selectedProjects}
        strings={{
          label: t('agentHub.mirror.projectFilter.label', 'Projects'),
          add: t('agentHub.mirror.projectFilter.add', 'Project'),
          all: t('agentHub.mirror.projectFilter.all', 'All projects'),
          search: t('agentHub.mirror.projectFilter.search', 'Search projects…'),
          noMatch: t('agentHub.mirror.projectFilter.noMatch', 'No projects match.'),
          remove: (label) =>
            t('agentHub.mirror.projectFilter.remove', 'Remove {{value0}} from the filter', {
              value0: label
            })
        }}
        onChange={onProjectsChange}
        onClosed={onClosed}
      />
      {bots.length > 0 ? (
        <>
          <span aria-hidden className="mx-1 h-4 w-px bg-border" />
          <AgentHubPickerChipFilter
            id="bot"
            items={bots.map((entry) => ({
              key: entry.key,
              label: entry.bot.name,
              count: entry.count,
              leading: (
                <BotAvatar bot={entry.bot} className="size-4 shrink-0 rounded-md text-[10px]" />
              )
            }))}
            selected={selectedBots}
            strings={{
              label: t('agentHub.mirror.botFilter.label', 'Bots'),
              add: t('agentHub.mirror.botFilter.add', 'Bot'),
              all: t('agentHub.mirror.botFilter.all', 'All bots'),
              search: t('agentHub.mirror.botFilter.search', 'Search bots…'),
              noMatch: t('agentHub.mirror.botFilter.noMatch', 'No bots match.'),
              remove: (label) =>
                t('agentHub.mirror.botFilter.remove', 'Remove {{value0}} from the filter', {
                  value0: label
                })
            }}
            onChange={onBotsChange}
            onClosed={onClosed}
          />
        </>
      ) : null}
      {selectedProjects.size > 0 || selectedBots.size > 0 ? (
        <Button type="button" variant="ghost" size="xs" onClick={onClear}>
          {t('agentHub.mirror.projectFilter.clear', 'Clear filter')}
        </Button>
      ) : null}
    </div>
  )
}
