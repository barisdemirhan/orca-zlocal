import { createContext } from 'react'

/** Retained chats change presentation with their destination, without changing their session. */
export const NativeChatPresentationContext = createContext<'chat' | 'orb'>('chat')
