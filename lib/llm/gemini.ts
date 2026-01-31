import { GoogleGenerativeAI, FunctionDeclaration, SchemaType } from '@google/generative-ai'
import type { LLMMessage } from './types'
import { SYSTEM_PROMPT } from './prompts'

const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set')
  }
  return new GoogleGenerativeAI(apiKey)
}

// Tool 1: Add a new map element
const addMapElementTool: FunctionDeclaration = {
  name: 'addMapElement',
  description:
    'Add a new element to the map. Use this to create pins for locations, areas for regions, routes for paths, arcs for connections between places, or lines.',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      elementType: {
        type: SchemaType.STRING,
        description: 'Type of element: "pin", "area", "route", "arc", or "line"',
      } as const,
      coordinates: {
        type: SchemaType.STRING,
        description:
          'JSON string of coordinates. For pin: "[lng, lat]". For area: "[[[lng,lat], ...]]". For route/line: "[[lng,lat], ...]". For arc: "{ source: [lng,lat], target: [lng,lat] }"',
      } as const,
      properties: {
        type: SchemaType.STRING,
        description:
          'JSON string with element properties: { title, description, color?, timeRange?: { start, end? }, article?: { title, content } }',
      } as const,
    },
    required: ['elementType', 'coordinates', 'properties'],
  },
}

// Tool 2: Update an existing map element
const updateMapElementTool: FunctionDeclaration = {
  name: 'updateMapElement',
  description:
    'Update properties of an existing map element by its ID. Use this to modify title, description, color, visibility, or other properties.',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      elementId: {
        type: SchemaType.STRING,
        description: 'The ID of the element to update',
      } as const,
      newProperties: {
        type: SchemaType.STRING,
        description:
          'JSON string with properties to update: { title?, description?, color?, visible?, timeRange?, article? }',
      } as const,
    },
    required: ['elementId', 'newProperties'],
  },
}

// Tool 3: Remove a map element
const removeMapElementTool: FunctionDeclaration = {
  name: 'removeMapElement',
  description: 'Remove an element from the map by its ID.',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      elementId: {
        type: SchemaType.STRING,
        description: 'The ID of the element to remove',
      } as const,
    },
    required: ['elementId'],
  },
}

// Tool 4: Set map view
const setMapViewTool: FunctionDeclaration = {
  name: 'setMapView',
  description: 'Set the map view to focus on a specific location and zoom level.',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      longitude: {
        type: SchemaType.NUMBER,
        description: 'Longitude of the center point',
      } as const,
      latitude: {
        type: SchemaType.NUMBER,
        description: 'Latitude of the center point',
      } as const,
      zoom: {
        type: SchemaType.NUMBER,
        description: 'Zoom level (1-20, where 1 is world view and 20 is street level)',
      } as const,
    },
    required: ['longitude', 'latitude', 'zoom'],
  },
}

// Tool 5: Get route between two points (follows actual roads/paths)
const getRouteTool: FunctionDeclaration = {
  name: 'getRoute',
  description:
    "Get a route between two locations that follows actual roads or paths. The system will AUTO-SELECT the best transport mode based on distance (walking for <3km, cycling for 3-15km, driving for >15km) unless the user specifies a preference. IMPORTANT: After the route is created, tell the user what mode was selected and why if they didn't specify one.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      startLng: {
        type: SchemaType.NUMBER,
        description: 'Longitude of the starting point',
      } as const,
      startLat: {
        type: SchemaType.NUMBER,
        description: 'Latitude of the starting point',
      } as const,
      endLng: {
        type: SchemaType.NUMBER,
        description: 'Longitude of the destination',
      } as const,
      endLat: {
        type: SchemaType.NUMBER,
        description: 'Latitude of the destination',
      } as const,
      mode: {
        type: SchemaType.STRING,
        description:
          'Optional transport mode: "walking", "driving", or "cycling". Only set this if the user explicitly requests a specific mode. Leave empty to auto-select based on distance.',
      } as const,
      properties: {
        type: SchemaType.STRING,
        description: 'JSON string with route properties: { title, description, color? }',
      } as const,
    },
    required: ['startLng', 'startLat', 'endLng', 'endLat', 'properties'],
  },
}

export interface ToolCall {
  name: string
  args: Record<string, unknown>
}

export interface ChatWithToolsResult {
  content: string
  toolCalls?: ToolCall[]
}

// Chat function with map control tools
export async function chatWithMapTools(
  messages: LLMMessage[],
  mapState: string, // JSON string of current map elements
): Promise<ChatWithToolsResult> {
  const genAI = getGeminiClient()
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    tools: [
      {
        functionDeclarations: [
          addMapElementTool,
          updateMapElementTool,
          removeMapElementTool,
          setMapViewTool,
          getRouteTool,
        ],
      },
    ],
  })

  // Build system prompt with map state context
  const systemWithMapState = `${SYSTEM_PROMPT}

CURRENT MAP STATE:
${mapState}

When adding elements, generate unique IDs like "pin_1", "area_1", etc. Check the current map state to avoid duplicate IDs.
Use accurate real-world coordinates (longitude, latitude) for locations.`

  // Convert messages to Gemini format
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

  console.log('\n========== CHAT WITH MAP TOOLS ==========')
  console.log('Model: gemini-2.0-flash')
  console.log('Tools: addMapElement, updateMapElement, removeMapElement, setMapView, getRoute')
  console.log('Messages count:', messages.length)
  console.log('Last message:', lastMessage.content)
  console.log('Map state elements count:', JSON.parse(mapState).length)
  console.log('--- History ---')
  history.forEach((h, i) =>
    console.log(`  ${i + 1}. [${h.role}]: ${h.parts[0].text.substring(0, 100)}...`),
  )
  console.log('--- End History ---\n')

  const result = await chat.sendMessage(lastMessage.content)
  const response = result.response

  // Check for function calls
  const functionCalls = response.functionCalls()

  if (functionCalls && functionCalls.length > 0) {
    console.log('--- Tool Calls ---')
    console.log(JSON.stringify(functionCalls, null, 2))
    console.log('--- End Tool Calls ---\n')

    return {
      content: response.text() || '',
      toolCalls: functionCalls.map((fc) => ({
        name: fc.name,
        args: fc.args as Record<string, unknown>,
      })),
    }
  }

  const responseText = response.text()
  console.log('--- Response ---')
  console.log(responseText)
  console.log('==========================================\n')

  return { content: responseText }
}
