/** The mirror window holding this element, as a pane is held while a mirror shows it. */
export function agentHubMirrorWindowIdOf(element: Element): string | null {
  return element.closest<HTMLElement>('[data-agent-hub-mirror]')?.dataset.agentHubMirrorKey ?? null
}
