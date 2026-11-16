import { describe, expect, it } from 'vitest'

import { COMMAND_SPECS } from '../specs'
import { normalizeCommandPositionals, parseArgs } from './args'

describe('parseArgs', () => {
  it('reads the Hub wait duration without changing orchestration’s boolean wait', () => {
    const hub = parseArgs(['hub', 'ask', 'Go?', '--wait', '2s'], undefined, COMMAND_SPECS)
    expect(hub.commandPath).toEqual(['hub', 'ask', 'Go?'])
    expect(hub.flags.get('wait')).toBe('2s')
    const orchestration = parseArgs(['orchestration', 'check', '--wait'], undefined, COMMAND_SPECS)
    expect(orchestration.commandPath).toEqual(['orchestration', 'check'])
    expect(orchestration.flags.get('wait')).toBe(true)
  })
  it('preserves a selector value that is also a registered command', () => {
    const parsed = parseArgs(
      ['--environment', 'status', 'worktree', 'list'],
      [['status'], ['worktree', 'list']]
    )

    expect(parsed.commandPath).toEqual(['worktree', 'list'])
    expect(parsed.flags.get('environment')).toBe('status')
  })

  it('preserves a selector value that is also a command group', () => {
    const parsed = parseArgs(
      ['--environment', 'worktree', 'status'],
      [['status'], ['worktree', 'list']]
    )

    expect(parsed.commandPath).toEqual(['status'])
    expect(parsed.flags.get('environment')).toBe('worktree')
  })

  it('normalizes partial positionals without conflicting later flag-supplied args', () => {
    const parsed = normalizeCommandPositionals(
      [
        {
          path: ['emulator', 'permissions'],
          summary: 'Permissions',
          usage: 'orca emulator permissions <op> <package> [permission]',
          allowedFlags: ['op', 'package', 'permission'],
          positionalArgs: ['op', 'package', 'permission']
        }
      ],
      parseArgs([
        'emulator',
        'permissions',
        'grant',
        '--package',
        'com.example.app',
        '--permission',
        'android.permission.CAMERA'
      ])
    )

    expect(parsed.commandPath).toEqual(['emulator', 'permissions'])
    expect(parsed.flags.get('op')).toBe('grant')
    expect(parsed.flags.get('package')).toBe('com.example.app')
    expect(parsed.flags.get('permission')).toBe('android.permission.CAMERA')
    expect(parsed.positionalFlagConflicts).toEqual([])
  })
})
