import { ELECTRON_REMOTE_RUNTIME_CLIENT_CAPABILITIES } from '../../../../../shared/electron-remote-runtime-client-capabilities'
import { remoteRuntimeClientCapabilities } from '../../../../../shared/remote-runtime/remote-runtime-client-capabilities'
import { isWebClientLocation } from '@/app-shell/platform/web-client-location'
import { WEB_RUNTIME_CLIENT_CAPABILITIES } from '../../../../../shared/web-runtime-client-capabilities'
import {
  AGENT_HUB_REQUESTS_CAPABILITY,
  AGENT_HUB_GATES_CAPABILITY
} from '../../../../../shared/agent-hub-capabilities'

/** What this client tells a paired host it can do, exactly as its handshake sends it: the desktop's
 *  transports add the shared remote base to the Electron list; the browser client sends its own. */
export function pairedHostClientCapabilities(agentHubConsumer = false): readonly string[] {
  return isWebClientLocation()
    ? WEB_RUNTIME_CLIENT_CAPABILITIES
    : remoteRuntimeClientCapabilities([
        ...ELECTRON_REMOTE_RUNTIME_CLIENT_CAPABILITIES,
        ...(agentHubConsumer ? [AGENT_HUB_REQUESTS_CAPABILITY, AGENT_HUB_GATES_CAPABILITY] : [])
      ])
}
