import type {
  AgentHubDelivery,
  AgentHubRendererApi,
  AgentHubRequest,
  AgentHubResponse
} from '../../../../shared/agent-hub-requests'
import { isAgentHubUnsupportedError } from '@/runtime/agent-hub-consumer-capability'

export type AgentHubConsumerHost = {
  host: string
  /** A changed pairing, socket generation or contact epoch fences callbacks from the previous subscription. */
  revision: string
}
type Subscription = { revision: string; stop: () => void; active: boolean; handled: Set<string> }
type ConsumerDependencies = {
  client: (host: string) => AgentHubRendererApi
  apply: (host: string, delivery: AgentHubDelivery) => void
  clear: (host: string) => void
  execute: (host: string, request: AgentHubRequest) => Promise<AgentHubResponse | null>
  onError: (error: unknown) => void
}

export class AgentHubRequestConsumer {
  private readonly subscriptions = new Map<string, Subscription>()
  constructor(private readonly dependencies: ConsumerDependencies) {}

  update(enabled: boolean, hosts: readonly AgentHubConsumerHost[]): void {
    const wanted = new Map(enabled ? hosts.map((host) => [host.host, host]) : [])
    for (const [host, subscription] of this.subscriptions) {
      if (wanted.get(host)?.revision !== subscription.revision) {
        subscription.active = false
        subscription.stop()
        this.subscriptions.delete(host)
        this.dependencies.clear(host)
      }
    }
    for (const { host, revision } of wanted.values()) {
      if (this.subscriptions.has(host)) {
        continue
      }
      const client = this.dependencies.client(host)
      const subscription: Subscription = {
        revision,
        stop: () => {},
        active: true,
        handled: new Set()
      }
      this.subscriptions.set(host, subscription)
      const reportError = (error: unknown): void => {
        if (
          subscription.active &&
          !isAgentHubUnsupportedError(error) &&
          !(
            typeof error === 'object' &&
            error !== null &&
            'code' in error &&
            ['already_resolved', 'request_not_found'].includes(String(error.code))
          )
        ) {
          this.dependencies.onError(error)
        }
      }
      const execute = async (request: AgentHubRequest): Promise<void> => {
        if (!subscription.active || subscription.handled.has(request.requestId)) {
          return
        }
        subscription.handled.add(request.requestId)
        try {
          const result = await this.dependencies.execute(host, request)
          if (result && subscription.active && subscription.handled.has(request.requestId)) {
            await client.respond(request.requestId, result)
          }
        } catch (error) {
          reportError(error)
        }
      }
      subscription.stop = client.subscribe((delivery) => {
        if (!subscription.active) {
          return
        }
        this.dependencies.apply(host, delivery)
        if (delivery.kind === 'closed') {
          subscription.handled.delete(delivery.requestId)
        } else if (delivery.kind === 'snapshot') {
          for (const request of delivery.snapshot.requests) {
            void execute(request)
          }
        } else if (delivery.kind !== 'progress') {
          void execute(delivery)
        }
      })
    }
  }

  dispose(): void {
    this.update(false, [])
  }
}
