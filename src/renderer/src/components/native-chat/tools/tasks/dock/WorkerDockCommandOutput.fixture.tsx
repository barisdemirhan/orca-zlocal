import { useState } from 'react'
import { defineFixture } from '../../../../../component-fixtures/component-fixture'
import { WorkerDockCommandSheet } from './WorkerDockCommandSheet'
import { workerDockFixturePane } from './worker-dock-pane-fixture'
import { OUTPUT_FILE_LINES, answerCommandOutputFile } from './worker-dock-command-output-fixture'
import { SOURCE, worker } from './worker-dock-seed-fixture'
import type { WorkerDockRowView } from './WorkerDockRow'

const commandRow = (mode: 'done' | 'running'): WorkerDockRowView => ({
  ...worker(0, mode === 'done' ? 'idle' : 'running', false),
  kind: 'command',
  id: 'command:shell-fixture',
  providerId: 'shell-fixture',
  title: 'Check the build'
})

// The chat's command sheet open on a background command whose output is only in its file.
function CommandSheetScene({ mode }: { mode: 'done' | 'running' }) {
  const [opener, setOpener] = useState<HTMLButtonElement | null>(null)
  const [row] = useState(() => commandRow(mode))
  return (
    <>
      <button ref={setOpener} type="button" className="text-xs">
        Check the build
      </button>
      {opener ? (
        <WorkerDockCommandSheet
          row={row}
          opener={opener}
          paneKey="worker-dock-fixture"
          sessionId={SOURCE}
          target={{ kind: 'local' }}
          worktreeId="fixture-worktree"
          onClose={() => {}}
        />
      ) : null}
    </>
  )
}

function commandOutputFile(mode: 'done' | 'running') {
  return defineFixture({
    width: 720,
    setup: () => {
      const previous = window.api.runtime.call
      const file = { lines: OUTPUT_FILE_LINES }
      window.api.runtime.call = async (request) => {
        const result = answerCommandOutputFile(request.method, request.params, mode, file)
        return result
          ? { id: 'dock-fixture', ok: true as const, result, _meta: { runtimeId: 'fixture' } }
          : previous(request)
      }
    },
    render: () => workerDockFixturePane(<CommandSheetScene mode={mode} />)
  })
}

// A settled command: the sheet shows the last 20 of the file's 40 lines under the earlier-output line.
export const commandOutputFile720 = commandOutputFile('done')
// Still running: the file gains a line at each read, so the tail moves every 3 s.
export const commandOutputFileRunning720 = commandOutputFile('running')
