/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it } from 'vitest'
import { isAgentHubCanvasLeaveClick } from './agent-hub-canvas-sidebar-leave'
import { blockAgentHubMirrorTabClick } from './agent-hub-mirror-gesture'

afterEach(() => {
  blockAgentHubMirrorTabClick(false)
  document.body.innerHTML = ''
})

function click(selector: string, keys: Partial<MouseEvent> = {}): boolean {
  const target = document.querySelector(selector)
  return isAgentHubCanvasLeaveClick({
    target,
    button: 0,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    ...keys
  })
}

describe('a left-sidebar click that leaves the canvas', () => {
  it('keeps the canvas open for a suppressed post-drag sidebar click', () => {
    document.body.innerHTML =
      '<div data-contextual-tour-target="sidebar-navigation"><button id="tasks" aria-current="page">Tasks</button></div>'
    blockAgentHubMirrorTabClick(true)
    expect(click('#tasks')).toBe(false)
    blockAgentHubMirrorTabClick(false)
    expect(click('#tasks')).toBe(true)
  })
  it('is a plain click on the current workspace card, not on a control inside it', () => {
    document.body.innerHTML = `
      <div data-worktree-sidebar>
        <div id="current" data-worktree-card-surface="true" data-worktree-card-active="primary">
          <span id="title">main</span>
          <button id="menu">…</button>
        </div>
        <div id="other" data-worktree-card-surface="true"><span id="other-title">dev</span></div>
      </div>`

    expect(click('#title')).toBe(true)
    expect(click('#current')).toBe(true)
    expect(click('#menu')).toBe(false)
    // Another workspace changes the active one, which leaves the canvas by itself.
    expect(click('#other-title')).toBe(false)
    // A selection gesture is not a navigation.
    expect(click('#title', { metaKey: true })).toBe(false)
    expect(click('#title', { shiftKey: true })).toBe(false)
  })

  it("is a click on the current bot's card or on any of its chats", () => {
    document.body.innerHTML = `
      <div data-bot-sidebar-entry="bot-1">
        <div id="bot" data-worktree-card-surface="true" data-worktree-card-active="primary">
          <span id="bot-name">Workspace cleanup</span>
          <button id="fold">⌄</button>
        </div>
        <div id="home" role="button" data-bot-sidebar-chat="home" aria-current="true">Home Chat</div>
        <div id="thread" role="button" data-bot-sidebar-chat="thread-2">
          <span id="thread-title">Friday run</span>
          <button id="chevron">›</button>
        </div>
      </div>
      <div data-bot-sidebar-entry="bot-2">
        <div data-worktree-card-surface="true"><span id="other-bot">Other</span></div>
      </div>`

    expect(click('#bot-name')).toBe(true)
    expect(click('#fold')).toBe(false)
    expect(click('#home')).toBe(true)
    expect(click('#thread-title')).toBe(true)
    expect(click('#chevron')).toBe(false)
    expect(click('#other-bot')).toBe(false)
  })

  it("is a click on the current page's navigation button", () => {
    document.body.innerHTML = `
      <div data-contextual-tour-target="sidebar-navigation">
        <button id="tasks" aria-current="page"><span id="label">Tasks</span></button>
        <button id="skills">Skills</button>
      </div>
      <button id="elsewhere" aria-current="page">Not the sidebar</button>`

    expect(click('#label')).toBe(true)
    expect(click('#tasks')).toBe(true)
    expect(click('#skills')).toBe(false)
    expect(click('#elsewhere')).toBe(false)
  })
})
