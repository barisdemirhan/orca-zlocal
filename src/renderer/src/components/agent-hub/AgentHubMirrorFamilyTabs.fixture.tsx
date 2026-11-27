import { defineFixture } from '../../component-fixtures/component-fixture'
import { makePaneKey } from '../../../../shared/workspace-layout/stable-pane-id'
import { agentHubThreadsFor } from './agent-hub-test-fixtures'
import { buildAgentHubLineage } from './agent-hub-lineage'
import { agentHubMirrorFamily } from './agent-hub-mirror-family'
import { AgentHubMirrorFamilyTabs } from './AgentHubMirrorFamilyTabs'

const leaf = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const key = (n: number): string => makePaneKey(`tab-${n}`, leaf(n))
const location = { group: null, project: 'Project', workspace: 'ws', host: 'Local Mac' }

function Frame({ workers }: { workers: number }): React.JSX.Element {
  const threads = agentHubThreadsFor([
    { paneKey: key(1), state: 'working', at: 1_000 },
    ...Array.from({ length: workers }, (_, index) => ({
      paneKey: key(index + 2),
      state: (index % 3 === 0 ? 'done' : 'working') as 'done' | 'working',
      at: 1_000,
      parentPaneKey: key(1)
    }))
  ])
  const family = agentHubMirrorFamily(key(1), threads, buildAgentHubLineage(threads, 1_000))
  return (
    <div className="w-120 overflow-hidden rounded-xl border border-foreground/25 bg-background">
      {family ? (
        <AgentHubMirrorFamilyTabs
          family={family}
          activeKey={key(2)}
          locationOf={() => location}
          actionsFor={() => ({ onJump: () => {} })}
          onSelect={() => {}}
        />
      ) : null}
    </div>
  )
}

export const fewWorkers = defineFixture({ width: 480, render: () => <Frame workers={3} /> })
export const overflowing = defineFixture({ width: 480, render: () => <Frame workers={9} /> })
