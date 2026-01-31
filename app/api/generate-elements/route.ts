import { NextRequest, NextResponse } from 'next/server'
import { geminiProvider } from '@/lib/llm/gemini'
import type { GenerateElementsRequest } from '@/lib/llm/types'

export async function POST(request: NextRequest) {
  try {
    const body: GenerateElementsRequest = await request.json()

    if (!body.prompt) {
      return NextResponse.json({ error: 'Invalid request: prompt required' }, { status: 400 })
    }

    const result = await geminiProvider.generateElements(body.prompt, body.context)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Generate elements API error:', error)
    return NextResponse.json({ error: 'Failed to generate map elements' }, { status: 500 })
  }
}
