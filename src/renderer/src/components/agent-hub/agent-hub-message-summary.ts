const SUMMARY_MAX_LENGTH = 180

/** Markdown an agent writes for a terminal, reduced to the words. */
function plainText(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s*(?:[-*+]|\d+\.)\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * A short, plain summary of an agent's last message, for alerts and one-line rows: the agent's
 * own recap line when it wrote one, else its opening sentences, cut at a sentence boundary.
 */
export function agentHubMessageSummary(text: string, maxLength = SUMMARY_MAX_LENGTH): string {
  const recap = /(?:^|\n)\s*(?:※\s*)?recap:\s*([^\n]+)/i.exec(text)
  // Claude appends its own settings hint to every recap.
  const plain = plainText((recap?.[1] ?? text).replace(/\(disable recaps in \/config\)/i, ''))
  if (plain.length <= maxLength) {
    return plain
  }
  const sentences = plain.match(/[^.!?]+(?:[.!?]+|$)\s*/g) ?? [plain]
  let summary = ''
  for (const sentence of sentences) {
    if (summary && summary.length + sentence.length > maxLength) {
      break
    }
    summary += sentence
  }
  summary = summary.trim()
  return summary.length > maxLength ? `${summary.slice(0, maxLength - 1).trimEnd()}…` : summary
}
