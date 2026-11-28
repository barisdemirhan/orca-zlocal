import { useEffect } from 'react'
import { useBotActivity } from '../bots/use-bot-activity'
import type { Bot } from '../../../../shared/bot-types'

export type AgentHubRunningBotRun = {
  key: string
  bot: Bot
  title: string
  at: number
  sessionId: string | null
}

/** Reads one bot's automation runs in progress and hands them up; it renders nothing itself. */
export function AgentHubBotRunsReporter({
  bot,
  onRuns
}: {
  bot: Bot
  onRuns: (botKey: string, runs: AgentHubRunningBotRun[]) => void
}): null {
  const inProgress = useBotActivity(bot).inProgress
  useEffect(() => {
    onRuns(
      `${bot.hostId}:${bot.id}`,
      inProgress.flatMap((row) =>
        row.kind === 'run'
          ? [{ key: row.key, bot, title: row.automationName, at: row.at, sessionId: row.sessionId }]
          : []
      )
    )
  }, [bot, inProgress, onRuns])
  return null
}
