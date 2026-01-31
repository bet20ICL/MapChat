import { GoogleGenerativeAI } from '@google/generative-ai'
import type { LLMProvider, LLMMessage, GenerateElementsResponse } from './types'
import { SYSTEM_PROMPT, GENERATE_ELEMENTS_PROMPT } from './prompts'

const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set')
  }
  return new GoogleGenerativeAI(apiKey)
}

export const geminiProvider: LLMProvider = {
  async chat(messages: LLMMessage[]): Promise<string> {
    const genAI = getGeminiClient()
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

    // Build conversation as a single prompt
    const conversationParts = [
      { text: `System: ${SYSTEM_PROMPT}\n\n` },
      ...messages.map((msg) => ({
        text: `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n`,
      })),
      { text: 'Assistant: ' },
    ]

    const fullPromptText = conversationParts.map(p => p.text).join('')

    // Log the API call context
    console.log('\n========== CHAT API CALL ==========')
    console.log('Model: gemini-2.0-flash')
    console.log('Messages count:', messages.length)
    console.log('--- Full Prompt ---')
    console.log(fullPromptText)
    console.log('--- End Prompt ---\n')

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: conversationParts }],
    })
    const responseText = result.response.text()

    console.log('--- Response ---')
    console.log(responseText)
    console.log('=====================================\n')

    return responseText
  },

  async generateElements(prompt: string, context?: string): Promise<GenerateElementsResponse> {
    const genAI = getGeminiClient()
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

    const fullPrompt = context
      ? `${GENERATE_ELEMENTS_PROMPT}\n\nContext: ${context}\n\nUser request: ${prompt}\n\nRespond with valid JSON only, no markdown code blocks.`
      : `${GENERATE_ELEMENTS_PROMPT}\n\nUser request: ${prompt}\n\nRespond with valid JSON only, no markdown code blocks.`

    // Log the API call context
    console.log('\n========== GENERATE ELEMENTS API CALL ==========')
    console.log('Model: gemini-2.0-flash')
    console.log('User prompt:', prompt)
    console.log('Context:', context || '(none)')
    console.log('--- Full Prompt ---')
    console.log(fullPrompt)
    console.log('--- End Prompt ---\n')

    const result = await model.generateContent(fullPrompt)
    let text = result.response.text()

    console.log('--- Raw Response ---')
    console.log(text)
    console.log('--- End Raw Response ---\n')

    // Clean up potential markdown code blocks
    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

    try {
      const parsed = JSON.parse(text) as GenerateElementsResponse
      console.log('--- Parsed Response ---')
      console.log(JSON.stringify(parsed, null, 2))
      console.log('=================================================\n')
      return parsed
    } catch (error) {
      console.error('Failed to parse Gemini response:', text)
      throw new Error('Failed to parse map elements from AI response')
    }
  },
}
