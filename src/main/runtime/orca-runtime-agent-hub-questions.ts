import { agentHookServer } from '../agent-hooks/server/agent-hook-server'
import { AgentHubQuestions } from './agent-hub/agent-hub-questions'
import { OrcaRuntimeWithAgentQuestions } from './construction/orca-runtime-agent-questions'

/** Agent Hub's pane questions read the transition detector, so they sit right above it. */
export abstract class OrcaRuntimeWithAgentHubQuestions extends OrcaRuntimeWithAgentQuestions {
  readonly agentHubQuestions = new AgentHubQuestions({
    readHookRow: (paneKey) => this.agentTransitions.latestRow(paneKey),
    panesNeedingYou: () => this.agentTransitions.panesNeedingYou(),
    readSettings: () => this.store?.getSettings(),
    ledger: this.agentHub,
    readGates: () => this.getAgentHubGateSnapshot(),
    readLastDrivingInputAt: (ptyId) => this.terminalRunFacts.readLastDrivingInputAt(ptyId),
    markQuestionAnswered: (request) => agentHookServer.inferQuestionAnswered(request),
    describePane: (_paneKey, handle) => {
      const pane = handle ? this.getAgentHubCaller(handle) : null
      return {
        ...(pane?.title ? { title: pane.title } : {}),
        ...(pane?.agentType ? { agent: pane.agentType } : {})
      }
    }
  })
}
