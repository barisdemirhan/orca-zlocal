// The Orb bot's MEMORY.md changes only through the bot's memory record, so a turn end neither
// restores a forgotten line nor credits a remembered one to the chat.
import { addBotMemoryFact, botMemoryChange, botMemoryDate } from '../../../shared/bot-memory-lines'
import type { Bot } from '../../../shared/bot-types'
import { botHomeFolder } from '../../bots/bot-home'
import type { BotController } from '../../bots/bot-controller'
import {
  cleanAgentHubOrbMemoryText,
  withoutAgentHubOrbMemory
} from './agent-hub-orb-identity-files'

type MemoryBots = Pick<BotController, 'memory'>

export async function forgetAgentHubOrbBotMemory(
  bots: MemoryBots,
  bot: Bot,
  line: string | null
): Promise<void> {
  await bots.memory.change(bot.id, botHomeFolder(bot), { kind: 'owner' }, (file, record) => ({
    added: [],
    removed: [file, record ?? ''].flatMap(
      (text) => botMemoryChange(text, withoutAgentHubOrbMemory(text, line)).removed
    )
  }))
}

export async function addAgentHubOrbBotMemory(
  bots: MemoryBots,
  bot: Bot,
  text: string,
  date: Date
): Promise<void> {
  await bots.memory.change(bot.id, botHomeFolder(bot), { kind: 'owner' }, (file) =>
    botMemoryChange(
      file,
      addBotMemoryFact(file, cleanAgentHubOrbMemoryText(text), botMemoryDate(date))
    )
  )
}
