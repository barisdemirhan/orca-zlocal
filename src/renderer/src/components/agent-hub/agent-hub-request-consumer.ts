import type {
  AgentHubDelivery,
  AgentHubGate,
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
type Subscription = {
  revision: string
  client: AgentHubRendererApi
  stop: () => void
  active: boolean
  handled: Set<string>
}
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
        client,
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

  async resolveGate(host: string, gate: AgentHubGate, resolution: string): Promise<void> {
    await this.sendCurrent(host, (client) => {
      if (!client.resolveGate) {
        throw Object.assign(new Error('Host cannot resolve decision gates'), {
          code: 'unsupported_method'
        })
      }
      return client.resolveGate(gate, resolution)
    })
  }

  async respond(host: string, requestId: string, result: AgentHubResponse): Promise<void> {
    await this.sendCurrent(host, async (client) => {
      await client.respond(requestId, result)
    })
  }

  private async sendCurrent(
    host: string,
    send: (client: AgentHubRendererApi) => Promise<void>
  ): Promise<void> {
    const subscription = this.subscriptions.get(host)
    if (!subscription?.active) {
      throw Object.assign(new Error('Agent Hub host disconnected'), { code: 'connection_lost' })
    }
    const ensureCurrent = (): void => {
      if (!subscription.active || this.subscriptions.get(host) !== subscription) {
        throw Object.assign(new Error('Agent Hub host changed'), { code: 'connection_lost' })
      }
    }
    try {
      await send(subscription.client)
    } catch (error) {
      ensureCurrent()
      throw error
    }
    ensureCurrent()
  }
}
