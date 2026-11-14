import { z } from 'zod'
import { isAgentSessionVoiceSdp } from '../agent-session-voice'
import { MutationEnvelope } from './structured-agent-session/structured-agent-session-mutation-envelope'
import { Identifier, SessionId } from './structured-agent-session/structured-agent-session-identifiers'

const VoiceOwner = {
  voiceSessionId: Identifier('Invalid voice session id'),
  generation: z.number().int().positive().max(Number.MAX_SAFE_INTEGER)
}

export const VoiceCapabilityParams = z.object({ sessionId: SessionId }).strict()
export const SubscribeVoiceParams = z.object({ sessionId: SessionId, ...VoiceOwner }).strict()
export const StartVoiceParams = z
  .object({
    envelope: MutationEnvelope,
    ...VoiceOwner,
    sdp: z.custom<string>(isAgentSessionVoiceSdp, 'Invalid voice SDP offer')
  })
  .strict()
export const StopVoiceParams = z.object({ envelope: MutationEnvelope, ...VoiceOwner }).strict()
export const AppendVoiceTextParams = z
  .object({ envelope: MutationEnvelope, ...VoiceOwner, text: z.string().trim().min(1).max(8192) })
  .strict()
