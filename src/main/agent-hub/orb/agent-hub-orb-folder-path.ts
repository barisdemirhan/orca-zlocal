import path from 'node:path'
import { getAppEnvironment } from '../../../shared/app-lifecycle/app-environment'

const ORB_DIRNAME = 'orb'

/** The app-owned folder Orb runs in; a desktop-only root, like the floating workspace. */
export function getAgentHubOrbDirectory(): string {
  return path.join(getAppEnvironment().getPath('userData'), ORB_DIRNAME)
}
