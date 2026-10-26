export type HostNamesApi = {
  /** The addresses a name resolves to on this machine; empty when it does not resolve. */
  lookup: (args: { hostname: string }) => Promise<string[]>
}
