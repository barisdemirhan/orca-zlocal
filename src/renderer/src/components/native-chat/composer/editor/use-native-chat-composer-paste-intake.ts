import type { useNativeChatComposerAttachments } from '../../attachments/chips/use-native-chat-composer-attachments'
import type { useNativeChatFileDrops } from '../../attachments/intake/use-native-chat-file-drops'
import type * as C from '../native-chat-composer-types'
import { useNativeChatComposerHandle } from './use-native-chat-composer-handle'

type HandleArgs = Parameters<typeof useNativeChatComposerHandle>[1]

type PasteIntakeArgs = Pick<
  HandleArgs,
  | 'resend'
  | 'textareaRef'
  | 'isComposing'
  | 'caret'
  | 'setDraft'
  | 'setCaret'
  | 'setActiveSuggestion'
  | 'agent'
  | 'disabled'
  | 'setNotice'
> & {
  handleRef: Parameters<typeof useNativeChatComposerHandle>[0]
  draftScopeKey: string
  paneKey: string
  targetPtyId: C.NativeChatComposerProps['targetPtyId']
  structuredTransport: C.NativeChatComposerProps['structuredTransport']
  fileDrops: ReturnType<typeof useNativeChatFileDrops>
  attachments: ReturnType<typeof useNativeChatComposerAttachments>
}

export function useNativeChatComposerPasteIntake({
  handleRef,
  draftScopeKey,
  paneKey,
  targetPtyId,
  structuredTransport,
  fileDrops,
  attachments,
  ...rest
}: PasteIntakeArgs): ReturnType<typeof useNativeChatComposerHandle> {
  return useNativeChatComposerHandle(handleRef, {
    ...rest,
    attachmentScopeKey: draftScopeKey,
    targetKey: JSON.stringify([
      paneKey,
      targetPtyId,
      structuredTransport?.sessionId,
      structuredTransport?.worktreeId,
      structuredTransport?.runtimeEnvironmentId
    ]),
    resolveAttachmentOwner: fileDrops.resolveAttachmentOwner,
    attachResolvedPaths: attachments.attachResolvedPaths,
    attachCopiedFiles: fileDrops.attachExternalPaths,
    captureCopiedFiles: fileDrops.captureCopiedFiles,
    captureExternalPaths: fileDrops.captureExternalPaths,
    beginPendingImageAttachment: attachments.beginPendingImageAttachment,
    // Settles into the scope cache, which outlives a composer a prompt card unmounted.
    resolvePendingImageAttachment: attachments.pendingChips.resolve,
    revealPendingImageAttachment: attachments.revealPendingImageAttachment,
    dropPendingImageAttachment: attachments.dropPendingImageAttachment,
    pastedTextEditor: structuredTransport ? attachments.scopeEditor : null
  })
}
