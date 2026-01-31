import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ChatMessage } from '@/types'
import { generateId } from '@/lib/utils/id'

interface ChatState {
  messages: ChatMessage[]
  isLoading: boolean

  // Actions
  addMessage: (role: ChatMessage['role'], content: string) => ChatMessage
  updateMessage: (id: string, content: string) => void
  clearMessages: () => void
  setLoading: (loading: boolean) => void
  setMessages: (messages: ChatMessage[]) => void
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      messages: [],
      isLoading: false,

      addMessage: (role, content) => {
        const message: ChatMessage = {
          id: generateId(),
          role,
          content,
          timestamp: new Date().toISOString(),
        }
        set((state) => ({
          messages: [...state.messages, message],
        }))
        return message
      },

      updateMessage: (id, content) =>
        set((state) => ({
          messages: state.messages.map((msg) => (msg.id === id ? { ...msg, content } : msg)),
        })),

      clearMessages: () =>
        set({
          messages: [],
        }),

      setLoading: (loading) =>
        set({
          isLoading: loading,
        }),

      setMessages: (messages) =>
        set({
          messages,
        }),
    }),
    {
      name: 'mapchat-chat-store',
      partialize: (state) => ({ messages: state.messages }),
    },
  ),
)
