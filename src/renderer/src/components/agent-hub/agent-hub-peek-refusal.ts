import { translate } from '@/i18n/i18n'
import { normalizeAbsolutePath } from '../../../../shared/file-links/file-link-path-normalization'
import { agentHubPeekFileKind } from './agent-hub-peek-routing'

export function agentHubPeekRefusalReason(link: string): string {
  const file =
    !/^[a-z][a-z\d+.-]*:/i.test(link) ||
    Boolean(normalizeAbsolutePath(link)) ||
    link.startsWith('file://')
  return file && !agentHubPeekFileKind(link)
    ? translate(
        'agentHub.requests.peekUnsupportedFile',
        'This file type cannot be shown in Peek. Open it in the workspace or default app.'
      )
    : translate(
        'agentHub.requests.peekUnsupported',
        'This URL or file cannot be opened in Peek on its host.'
      )
}
