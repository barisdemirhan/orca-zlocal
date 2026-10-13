import { translate } from '@/i18n/i18n'
import { normalizeAbsolutePath } from '@/lib/terminal-path-normalization'
import { agentHubPeekFileKind } from './agent-hub-peek-routing'

export function agentHubPeekRefusalReason(link: string): string {
  const file =
    !/^[a-z][a-z\d+.-]*:/i.test(link) ||
    Boolean(normalizeAbsolutePath(link)) ||
    link.startsWith('file://')
  return file && !agentHubPeekFileKind(link)
    ? translate(
        'agentHub.requests.peekUnsupportedFile',
        'Peek opens web pages, images, PDF, audio, video, HTML and Markdown files. This file type is not supported.'
      )
    : translate(
        'agentHub.requests.peekUnsupported',
        'This URL or file cannot be opened in Peek on its host.'
      )
}
