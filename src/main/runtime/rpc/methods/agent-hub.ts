import { defineMethod } from '../core'
import {
  AgentHubNotifyParams,
  AgentHubPeekParams,
  AgentHubPeekControlParams,
  AgentHubAskParams,
  AgentHubProgressParams,
  AgentHubPresenceParams,
  AgentHubStatusParams,
  AgentHubMirrorParams,
  AgentHubArrangeParams,
  AgentHubCanvasParams,
  AgentHubRespondParams,
  AgentHubQuestionsParams,
  AgentHubAnswerParams
} from '../../../../shared/rpc-contract/agent-hub-params'
import { agentHubDesktopId, resolveAgentHubPanes } from './agent-hub-caller'
import { AgentHubError } from '../../agent-hub/agent-hub-error'
import { waitForAgentHubAnswer } from '../../agent-hub/agent-hub-answer-wait'
import { randomUUID } from 'node:crypto'
import { respondToAgentHubMemory } from './agent-hub-orb-memory'
import type {
  AgentHubAnswerResult,
  AgentHubQuestionsResult
} from '../../../../shared/agent-hub-questions'

export const AGENT_HUB_METHODS = [
  defineMethod({
    name: 'agentHub.notify',
    permission: 'workspace',
    params: AgentHubNotifyParams,
    handler: (params, ctx) => {
      const { caller, target } = resolveAgentHubPanes(params, ctx)
      return ctx.runtime.agentHub.notify(caller, target, {
        text: params.text,
        level: params.level,
        sound: params.sound,
        links: params.links
      })
    }
  }),
  defineMethod({
    name: 'agentHub.peek',
    permission: 'workspace',
    params: AgentHubPeekParams,
    handler: (params, ctx) => {
      const { caller, target } = resolveAgentHubPanes(params, ctx, 'peek')
      return ctx.runtime.agentHub.operate(
        caller,
        target,
        { kind: 'peek', link: params.link },
        ctx.signal
      )
    }
  }),
  defineMethod({
    name: 'agentHub.peekControl',
    permission: 'workspace',
    params: AgentHubPeekControlParams,
    handler: (params, ctx) => {
      // Peek is one view per desktop, so it is not addressed through another terminal.
      const { caller, target } = resolveAgentHubPanes({ ...params, terminal: undefined }, ctx)
      return ctx.runtime.agentHub.operate(
        caller,
        target,
        { kind: 'peek-control', action: params.action },
        ctx.signal
      )
    }
  }),
  defineMethod({
    name: 'agentHub.ask',
    permission: 'workspace',
    params: AgentHubAskParams,
    handler: (params, ctx) => {
      const { caller, target } = resolveAgentHubPanes(params, ctx)
      if (params.resume) {
        const requestId = params.resume
        return waitForAgentHubAnswer(requestId, params.waitMs, ctx.signal, (signal) =>
          ctx.runtime.agentHub.resume(caller, requestId, signal)
        )
      }
      if (!params.question || !params.options) {
        throw new AgentHubError('invalid_argument', 'Question and options are required')
      }
      const { question, options } = params
      const requestId = params.requestId ?? randomUUID()
      return waitForAgentHubAnswer(requestId, params.waitMs, ctx.signal, (signal) =>
        ctx.runtime.agentHub.ask(
          caller,
          target,
          {
            question,
            options,
            recommended: params.recommended,
            multi: params.multi,
            ifAway: params.ifAway
          },
          params.timeoutMs,
          requestId,
          signal
        )
      )
    }
  }),
  defineMethod({
    name: 'agentHub.progress',
    permission: 'workspace',
    params: AgentHubProgressParams,
    handler: (params, ctx) => {
      const { caller, target } = resolveAgentHubPanes(params, ctx)
      return ctx.runtime.agentHub.updateProgress(
        caller,
        target,
        params.clear ? null : (params.text ?? null)
      )
    }
  }),
  defineMethod({
    name: 'agentHub.presence',
    permission: 'workspace',
    params: AgentHubPresenceParams,
    handler: (params, ctx) => {
      const { caller, target } = resolveAgentHubPanes(params, ctx)
      return ctx.runtime.agentHub.presence(caller, target, ctx.signal)
    }
  }),
  defineMethod({
    name: 'agentHub.status',
    permission: 'workspace',
    params: AgentHubStatusParams,
    handler: (params, ctx) => {
      const { caller, target } = resolveAgentHubPanes(params, ctx)
      return ctx.runtime.agentHub.status(caller, target, ctx.signal)
    }
  }),
  defineMethod({
    name: 'agentHub.mirror',
    permission: 'workspace',
    params: AgentHubMirrorParams,
    handler: (params, ctx) => {
      const { caller, target } = resolveAgentHubPanes(params, ctx, 'mirror')
      const into = params.into ? ctx.runtime.getAgentHubCaller(params.into) : null
      if (params.into && !into) {
        throw new AgentHubError(
          'invalid_argument',
          'The --into terminal was not found on this host'
        )
      }
      return ctx.runtime.agentHub.operate(
        caller,
        target,
        {
          kind: 'mirror',
          action: params.action,
          ...(into ? { into: { paneKey: into.paneKey, terminalHandle: into.terminalHandle } } : {})
        },
        ctx.signal
      )
    }
  }),
  defineMethod({
    name: 'agentHub.arrange',
    permission: 'workspace',
    params: AgentHubArrangeParams,
    handler: (params, ctx) => {
      const { caller, target } = resolveAgentHubPanes(params, ctx, 'arrange')
      return ctx.runtime.agentHub.operate(
        caller,
        target,
        { kind: 'arrange', layout: params.layout },
        ctx.signal
      )
    }
  }),
  defineMethod({
    name: 'agentHub.canvas',
    permission: 'workspace',
    params: AgentHubCanvasParams,
    handler: (params, ctx) => {
      const { caller, target } = resolveAgentHubPanes(params, ctx, 'canvas')
      return ctx.runtime.agentHub.operate(
        caller,
        target,
        { kind: 'canvas', action: params.action },
        ctx.signal
      )
    }
  }),
  defineMethod({
    name: 'agentHub.respond',
    permission: 'workspace',
    params: AgentHubRespondParams,
    handler: (params, ctx) => {
      const desktop = agentHubDesktopId(ctx)
      if (!desktop) {
        throw new AgentHubError('no_desktop', 'Only a capable desktop can answer hub requests')
      }
      if (params.result.kind === 'memory') {
        return respondToAgentHubMemory(ctx.runtime, params.requestId, params.result, desktop)
      }
      return ctx.runtime.agentHub.respond(params.requestId, params.result, desktop)
    }
  }),
  defineMethod({
    name: 'agentHub.questions',
    permission: 'workspace',
    params: AgentHubQuestionsParams,
    handler: async (_params, ctx): Promise<AgentHubQuestionsResult> => {
      const { hostScope } = await ctx.runtime.listTerminals(undefined, 1, {
        includeVisualLayouts: false
      })
      return {
        questionsVersion: 1,
        questions: ctx.runtime.agentHubQuestions.list(ctx.runtime),
        ...(hostScope ? { hostScope } : {})
      }
    }
  }),
  defineMethod({
    name: 'agentHub.answer',
    permission: 'workspace',
    params: AgentHubAnswerParams,
    handler: (params, ctx): Promise<AgentHubAnswerResult> =>
      ctx.runtime.agentHubQuestions.answer(
        ctx.runtime,
        params.questionId,
        params.optionIds,
        params.verifyMs,
        ctx.signal ?? new AbortController().signal
      )
  })
] as const
