'use client'

import { useState, useEffect } from 'react'
import { useChatStore } from '@/stores/chatStore'
import { useMapStore } from '@/stores/mapStore'
import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'
import { toast } from 'sonner'
import { generateId } from '@/lib/utils/id'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { KeyRound } from 'lucide-react'
import type {
  MapElement,
  PinElement,
  AreaElement,
  RouteElement,
  LineElement,
  ArcElement,
} from '@/types'

interface ToolCall {
  name: string
  args: Record<string, unknown>
}

interface ChatResponse {
  content: string
  toolCalls: ToolCall[]
}

export function ChatPanel() {
  const { addMessage, setLoading, messages } = useChatStore()
  const { elements, addElement, updateElement, removeElement, setViewState } = useMapStore()
  const [apiKey, setApiKey] = useState<string | null>(null)
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [hasServerKey, setHasServerKey] = useState<boolean | null>(null)

  useEffect(() => {
    fetch('/api/config')
      .then((res) => res.json())
      .then((data) => setHasServerKey(data.hasServerKey))
      .catch(() => setHasServerKey(false))
  }, [])

  const handleToolCall = async (
    toolCall: ToolCall,
  ): Promise<{
    type: string
    success: boolean
  }> => {
    console.log('Executing tool:', toolCall.name, toolCall.args)

    switch (toolCall.name) {
      case 'addMapElement': {
        const { elementType, coordinates, properties } = toolCall.args
        try {
          const coords = JSON.parse(coordinates as string)
          const props = JSON.parse(properties as string)
          const id = props.id || `${elementType}_${generateId(6)}`

          let element: MapElement

          if (elementType === 'pin') {
            element = {
              id,
              type: 'pin',
              coordinates: coords as [number, number],
              title: props.title || 'Untitled',
              description: props.description || '',
              color: props.color,
              icon: props.icon || '📍',
              visible: true,
              timeRange: props.timeRange,
              article: props.article,
              createdBy: 'llm',
            } as PinElement
          } else if (elementType === 'area') {
            element = {
              id,
              type: 'area',
              coordinates: coords as [number, number][][],
              title: props.title || 'Untitled',
              description: props.description || '',
              color: props.color,
              visible: true,
              timeRange: props.timeRange,
              article: props.article,
              createdBy: 'llm',
            } as AreaElement
          } else if (elementType === 'route') {
            element = {
              id,
              type: 'route',
              coordinates: coords as [number, number][],
              title: props.title || 'Untitled',
              description: props.description || '',
              color: props.color,
              visible: true,
              timeRange: props.timeRange,
              article: props.article,
              createdBy: 'llm',
            } as RouteElement
          } else if (elementType === 'line') {
            element = {
              id,
              type: 'line',
              coordinates: coords as [number, number][],
              title: props.title || 'Untitled',
              description: props.description || '',
              color: props.color,
              visible: true,
              timeRange: props.timeRange,
              article: props.article,
              createdBy: 'llm',
            } as LineElement
          } else if (elementType === 'arc') {
            element = {
              id,
              type: 'arc',
              source: coords.source as [number, number],
              target: coords.target as [number, number],
              title: props.title || 'Untitled',
              description: props.description || '',
              color: props.color,
              visible: true,
              timeRange: props.timeRange,
              article: props.article,
              createdBy: 'llm',
            } as ArcElement
          } else {
            console.error('Unknown element type:', elementType)
            return { type: 'add', success: false }
          }

          addElement(element)
          console.log('Added element:', element)
          return { type: 'add', success: true }
        } catch (error) {
          console.error('Failed to add element:', error)
          return { type: 'add', success: false }
        }
      }

      case 'updateMapElement': {
        const { elementId, newProperties } = toolCall.args
        try {
          const props = JSON.parse(newProperties as string)
          updateElement(elementId as string, props)
          console.log('Updated element:', elementId, props)
          return { type: 'update', success: true }
        } catch (error) {
          console.error('Failed to update element:', error)
          return { type: 'update', success: false }
        }
      }

      case 'removeMapElement': {
        const { elementId } = toolCall.args
        removeElement(elementId as string)
        console.log('Removed element:', elementId)
        return { type: 'remove', success: true }
      }

      case 'setMapView': {
        const { longitude, latitude, zoom } = toolCall.args
        setViewState({
          longitude: longitude as number,
          latitude: latitude as number,
          zoom: zoom as number,
        })
        console.log('Set map view:', { longitude, latitude, zoom })
        return { type: 'view', success: true }
      }

      default:
        console.warn('Unknown tool call:', toolCall.name)
        return { type: 'unknown', success: false }
    }
  }

  const handleSend = async (content: string) => {
    addMessage('user', content)
    setLoading(true)

    try {
      // Send message with current map state
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            ...messages.map((m) => ({ role: m.role, content: m.content })),
            { role: 'user', content },
          ],
          mapState: JSON.stringify(elements),
          apiKey,
        }),
      })

      if (response.status === 401) {
        if (!hasServerKey) {
          setApiKey(null)
          setApiKeyInput('')
          toast.error('Invalid API key. Please enter a valid key.')
        } else {
          toast.error('Server API key is misconfigured.')
        }
        return
      }

      if (!response.ok) {
        throw new Error('Failed to get chat response')
      }

      const data: ChatResponse = await response.json()

      // Execute any tool calls
      if (data.toolCalls && data.toolCalls.length > 0) {
        let addedCount = 0
        let updatedCount = 0
        let removedCount = 0

        for (const toolCall of data.toolCalls) {
          const result = await handleToolCall(toolCall)
          if (result.success) {
            if (result.type === 'add') addedCount++
            if (result.type === 'update') updatedCount++
            if (result.type === 'remove') removedCount++
          }
        }

        // Show toast summary
        const actions = []
        if (addedCount > 0) actions.push(`Added ${addedCount} element${addedCount > 1 ? 's' : ''}`)
        if (updatedCount > 0)
          actions.push(`Updated ${updatedCount} element${updatedCount > 1 ? 's' : ''}`)
        if (removedCount > 0)
          actions.push(`Removed ${removedCount} element${removedCount > 1 ? 's' : ''}`)
        if (actions.length > 0) {
          toast.success(actions.join(', '))
        }
      }

      // Add assistant message
      const responseContent =
        data.content || (data.toolCalls?.length > 0 ? "Done! I've updated the map for you." : '')
      if (responseContent) {
        addMessage('assistant', responseContent)
      }
    } catch (error) {
      console.error('Chat error:', error)
      addMessage('assistant', 'Sorry, I encountered an error. Please try again.')
      toast.error('Failed to process your request')
    } finally {
      setLoading(false)
    }
  }

  const needsApiKey = hasServerKey === false && !apiKey

  if (hasServerKey === null) {
    return (
      <div className="flex flex-col h-full bg-background">
        <div className="px-4 py-3 border-b">
          <h2 className="font-semibold">Chat</h2>
          <p className="text-xs text-muted-foreground">{elements.length} elements on map</p>
        </div>
        <div className="flex-1" />
      </div>
    )
  }

  if (needsApiKey) {
    return (
      <div className="flex flex-col h-full bg-background">
        <div className="px-4 py-3 border-b">
          <h2 className="font-semibold">Chat</h2>
          <p className="text-xs text-muted-foreground">{elements.length} elements on map</p>
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-sm space-y-4 text-center">
            <KeyRound className="h-10 w-10 mx-auto text-muted-foreground" />
            <div>
              <h3 className="font-semibold text-lg">Enter your Gemini API Key</h3>
              <p className="text-sm text-muted-foreground mt-1">
                This app requires a Google Gemini API key to work. Your key is only stored in memory and never saved.
              </p>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                const trimmed = apiKeyInput.trim()
                if (trimmed) setApiKey(trimmed)
              }}
              className="flex flex-col gap-2"
            >
              <Input
                type="password"
                placeholder="AIzaSy..."
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
              />
              <Button type="submit" disabled={!apiKeyInput.trim()}>
                Start Chatting
              </Button>
            </form>
            <p className="text-xs text-muted-foreground">
              Get a key at{' '}
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                aistudio.google.com
              </a>
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="px-4 py-3 border-b">
        <h2 className="font-semibold">Chat</h2>
        <p className="text-xs text-muted-foreground">{elements.length} elements on map</p>
      </div>
      <MessageList />
      <ChatInput onSend={handleSend} />
    </div>
  )
}
