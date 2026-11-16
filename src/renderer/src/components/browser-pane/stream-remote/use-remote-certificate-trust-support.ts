import { useEffect, useState } from 'react'
import { BROWSER_CERTIFICATE_TRUST_RUNTIME_CAPABILITY } from '../../../../../shared/browser/runtime/browser-runtime-capabilities'
import { runtimeEnvironmentSupportsCapability } from '@/runtime/rpc/compatibility/runtime-capability-proof'

export function useRemoteCertificateTrustSupport(
  environmentId: string | undefined,
  certificateChallengeId: string | null
): boolean {
  // Why: runtimes predating browser.certificate-trust.v1 can't honor a proceed request, so hide "Proceed Anyway" until support is advertised.
  const [supported, setSupported] = useState(false)
  useEffect(() => {
    if (!environmentId || !certificateChallengeId) {
      setSupported(false)
      return
    }
    let cancelled = false
    void runtimeEnvironmentSupportsCapability(
      environmentId,
      BROWSER_CERTIFICATE_TRUST_RUNTIME_CAPABILITY
    )
      .then((result) => {
        if (!cancelled) {
          setSupported(result)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSupported(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [environmentId, certificateChallengeId])
  return supported
}
