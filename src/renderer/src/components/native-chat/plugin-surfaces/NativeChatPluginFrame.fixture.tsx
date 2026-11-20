import { defineFixture } from '../../../component-fixtures/component-fixture'
import type { AgentSessionPluginNode } from '../../../../../shared/agent-session/plugin-surfaces/agent-session-plugin-surface-wire'
import { NativeChatPluginFrame } from './NativeChatPluginFrame'

// Trees Claude Code 2.1.329 answered for Deck 0.9.0 at bodyColumns 50 (dock) and 96 (inline).
const DECK_DOCK: AgentSessionPluginNode = {
  type: 'Box',
  props: { flexDirection: 'column', paddingX: 1 },
  children: [
    {
      type: 'Box',
      props: { flexDirection: 'column' },
      children: [
        {
          type: 'Box',
          props: { columnGap: 2, flexWrap: 'wrap', justifyContent: 'space-between' },
          children: [
            {
              type: 'Box',
              props: { columnGap: 2 },
              children: [
                {
                  type: 'Text',
                  props: { bold: true, weight: 'semibold' },
                  children: ['Haiku 5.5']
                },
                {
                  type: 'Text',
                  props: { dimColor: true },
                  children: ['effort shows with the first request']
                }
              ]
            }
          ]
        },
        { type: 'Text', props: { dimColor: true, wrap: 'truncate-end' }, children: ['$0.00'] }
      ]
    },
    {
      type: 'Text',
      props: { dimColor: true, wrap: 'truncate' },
      children: ['────────────────────────────────────────────────']
    },
    { type: 'Text', props: { dimColor: true }, children: ['Nothing runs yet.'] },
    {
      type: 'Text',
      props: { dimColor: true },
      children: ['Shells, agents, MCP tasks and task lists Claude starts show here while they run.']
    }
  ]
}
const DECK_INLINE: AgentSessionPluginNode = {
  type: 'Box',
  props: { flexDirection: 'column', paddingX: 1 },
  children: [
    {
      type: 'Box',
      props: { flexDirection: 'column' },
      children: [
        {
          type: 'Box',
          props: { columnGap: 2, flexWrap: 'wrap', justifyContent: 'space-between' },
          children: [
            {
              type: 'Box',
              props: { columnGap: 2 },
              children: [
                {
                  type: 'Text',
                  props: { bold: true, weight: 'semibold' },
                  children: ['Haiku 5.5']
                },
                {
                  type: 'Text',
                  props: { dimColor: true },
                  children: ['effort shows with the first request']
                }
              ]
            },
            { type: 'Text', props: { dimColor: true, wrap: 'truncate-end' }, children: ['$0.00'] }
          ]
        }
      ]
    },
    {
      type: 'Text',
      props: { dimColor: true, wrap: 'truncate' },
      children: [
        '──────────────────────────────────────────────────────────────────────────────────────────────'
      ]
    },
    { type: 'Text', props: { dimColor: true }, children: ['Nothing runs yet.'] },
    {
      type: 'Text',
      props: { dimColor: true },
      children: ['Shells, agents, MCP tasks and task lists Claude starts show here while they run.']
    }
  ]
}
const BAND: AgentSessionPluginNode = {
  type: 'Box',
  props: { flexDirection: 'column' },
  children: [
    {
      type: 'Box',
      props: { columnGap: 1 },
      children: [
        { type: 'Text', props: { color: 'suggestion', bold: true }, children: ['You should know'] },
        { type: 'Text', props: { dimColor: true }, children: ['· tip'] }
      ]
    },
    { type: 'Text', children: ['Use /compact before long refactors to keep context small.'] },
    {
      type: 'Box',
      props: { columnGap: 2 },
      children: [
        {
          type: 'Button',
          props: { plain: true, dimColor: true },
          press: { plugin: 'cc-plugin-you-should-know', handle: 1 },
          children: ['Explain']
        },
        {
          type: 'Button',
          props: { plain: true, dimColor: true },
          press: { plugin: 'cc-plugin-you-should-know', handle: 2 },
          children: ['Dismiss']
        }
      ]
    }
  ]
}

function Frame({ tree }: { tree: AgentSessionPluginNode }): React.JSX.Element {
  return (
    <div className="flex h-[440px] flex-col bg-chat-canvas text-chat-foreground">
      <NativeChatPluginFrame
        plugins={{
          pluginPane: { id: 'deck', title: 'Deck', plugin: 'deck', columns: 52, rows: 14, tree },
          pluginBand: BAND,
          actOnPluginUi: () => {}
        }}
        transcript={<div className="flex-1 p-4 text-sm">Transcript</div>}
      />
      <div className="h-12 shrink-0 border-t border-chat-composer-border p-2 text-sm">Composer</div>
    </div>
  )
}

export const docked = defineFixture({ width: 1200, render: () => <Frame tree={DECK_DOCK} /> })
export const inline = defineFixture({ width: 720, render: () => <Frame tree={DECK_INLINE} /> })
