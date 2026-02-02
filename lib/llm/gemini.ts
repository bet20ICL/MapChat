import { GoogleGenerativeAI } from '@google/generative-ai'
import type { LLMMessage } from './types'
import { SYSTEM_PROMPT } from './prompts'
import {
  ALL_TOOL_DECLARATIONS,
  ACTION_TOOL_NAMES,
  DATA_TOOL_NAMES,
  executeDataTool,
} from './tools'

const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set')
  }
  return new GoogleGenerativeAI(apiKey)
}

export interface ToolCall {
  name: string
  args: Record<string, unknown>
}

export interface ChatWithToolsResult {
  content: string
  toolCalls?: ToolCall[]
}

const MAX_LOOP_ITERATIONS = 10

const actionToolSet = new Set<string>(ACTION_TOOL_NAMES)
const dataToolSet = new Set<string>(DATA_TOOL_NAMES)

export async function chatWithMapTools(
  messages: LLMMessage[],
  mapState: string,
): Promise<ChatWithToolsResult> {
  const genAI = getGeminiClient()
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-pro',
    tools: [{ functionDeclarations: ALL_TOOL_DECLARATIONS }],
  })

  const systemWithMapState = `${SYSTEM_PROMPT}

CURRENT MAP STATE:
${mapState}

When adding elements, generate unique IDs like "pin_1", "area_1", etc. Check the current map state to avoid duplicate IDs.`

  const history = messages.slice(0, -1).map((msg) => ({
    role: msg.role === 'assistant' ? ('model' as const) : ('user' as const),
    parts: [{ text: msg.content }],
  }))

  const chat = model.startChat({
    history,
    systemInstruction: {
      role: 'user',
      parts: [{ text: systemWithMapState }],
    },
  })

  const lastMessage = messages[messages.length - 1]

  console.log('\n========== CHAT WITH MAP TOOLS (AGENTIC) ==========')
  console.log('Model: gemini-2.5-pro')
  console.log('Messages count:', messages.length)
  console.log('Last message:', lastMessage.content)
  console.log('Map state elements count:', JSON.parse(mapState).length)

  // Accumulated action tool calls to return to client
  const accumulatedActionCalls: ToolCall[] = []
  let finalContent = ''

  // Send initial message
  let result = await chat.sendMessage(lastMessage.content)
  let response = result.response

  // ── Agentic loop ─────────────────────────────────────────────────────────
  for (let i = 0; i < MAX_LOOP_ITERATIONS; i++) {
    const functionCalls = response.functionCalls()

    if (!functionCalls || functionCalls.length === 0) {
      // No tool calls — capture final text and break
      finalContent = response.text() || ''
      break
    }

    console.log(`--- Loop iteration ${i + 1}: ${functionCalls.length} tool call(s) ---`)

    // Process each function call and build response parts
    const functionResponses: Array<{
      functionResponse: { name: string; response: unknown }
    }> = []

    for (const fc of functionCalls) {
      const name = fc.name
      const args = fc.args as Record<string, unknown>

      if (dataToolSet.has(name)) {
        // ── Data tool: execute server-side, return real result to LLM ──
        console.log(`  [DATA] ${name}(${JSON.stringify(args).substring(0, 200)})`)
        const { dataResult, actionToolCall } = await executeDataTool(name, args)
        console.log(`  [DATA] ${name} result:`, JSON.stringify(dataResult).substring(0, 300))

        // If the data tool also produces an action (calculateRoute), accumulate it
        if (actionToolCall) {
          accumulatedActionCalls.push(actionToolCall)
        }

        functionResponses.push({
          functionResponse: { name, response: dataResult },
        })
      } else if (actionToolSet.has(name)) {
        // ── Action tool: accumulate for client, stub success to LLM ──
        console.log(`  [ACTION] ${name}(${JSON.stringify(args).substring(0, 200)})`)
        accumulatedActionCalls.push({ name, args })

        functionResponses.push({
          functionResponse: { name, response: { success: true } },
        })
      } else {
        console.warn(`  [UNKNOWN] ${name}`)
        functionResponses.push({
          functionResponse: { name, response: { error: `Unknown tool: ${name}` } },
        })
      }
    }

    // Send all function responses back to Gemini
    result = await chat.sendMessage(functionResponses)
    response = result.response

    // Capture any text the model produced alongside potential new tool calls
    try {
      const text = response.text()
      if (text) finalContent = text
    } catch {
      // text() throws if response only contains function calls
    }
  }

  console.log(`--- Final: ${accumulatedActionCalls.length} action call(s), content length: ${finalContent.length} ---`)
  console.log('====================================================\n')

  return {
    content: finalContent,
    toolCalls: accumulatedActionCalls.length > 0 ? accumulatedActionCalls : undefined,
  }
}
