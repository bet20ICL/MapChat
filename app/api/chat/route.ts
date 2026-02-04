export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { chatWithMapTools } from '@/lib/llm/gemini'
import type { LLMMessage } from '@/lib/llm/types'

interface ChatRequestBody {
  messages: LLMMessage[]
  mapState: string // JSON string of current map elements
  apiKey?: string
}

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequestBody = await request.json()

    if (!body.messages || !Array.isArray(body.messages)) {
      return NextResponse.json(
        { error: 'Invalid request: messages array required' },
        { status: 400 },
      )
    }

    const apiKey = body.apiKey || process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key is required' },
        { status: 401 },
      )
    }

    const mapState = body.mapState || '[]'

    // Chat with map control tools
    const result = await chatWithMapTools(body.messages, mapState, apiKey)

    // Return the response with any tool calls
    return NextResponse.json({
      content: result.content,
      toolCalls: result.toolCalls || [],
    })
  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json({ error: 'Failed to process chat request' }, { status: 500 })
  }
}
