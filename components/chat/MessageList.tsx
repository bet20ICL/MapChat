'use client'

import { useEffect, useRef } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useChatStore } from '@/stores/chatStore'
import { MessageItem } from './MessageItem'
import { WordLoader } from './WordLoader'

export function MessageList() {
  const { messages, isLoading } = useChatStore()
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <ScrollArea className="flex-1 p-4">
      <div className="flex flex-col gap-4">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            <p className="text-lg font-medium">Welcome to MapChat!</p>
            <p className="text-sm mt-2">
              Ask me about places, landmarks, historical events, or routes.
            </p>
            <p className="text-sm">Try: &quot;Show me famous landmarks in Paris&quot;</p>
          </div>
        )}
        {messages.map((message) => (
          <MessageItem key={message.id} message={message} />
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-lg px-4 py-2">
              <WordLoader />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  )
}
