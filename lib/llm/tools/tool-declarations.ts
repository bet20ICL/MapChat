import { FunctionDeclaration, SchemaType } from '@google/generative-ai'

// ── Action tools (executed client-side) ──────────────────────────────────────

export const ACTION_TOOL_NAMES = [
  'addMapElement',
  'updateMapElement',
  'removeMapElement',
  'setMapView',
] as const

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
          'JSON string with element properties: { title, description, color?, icon? (emoji for pins, e.g. "⚔️" for battles, "🏰" for castles, "🏛️" for monuments), timeRange?: { start, end? }, article?: { title, content } }',
      } as const,
    },
    required: ['elementType', 'coordinates', 'properties'],
  },
}

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

// ── Data tools (executed server-side) ────────────────────────────────────────

const geocodeTool: FunctionDeclaration = {
  name: 'geocode',
  description:
    'Look up the coordinates of a place, address, or landmark by name. Returns lat/lng and display name. ALWAYS use this instead of guessing coordinates for specific addresses or places.',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      query: {
        type: SchemaType.STRING,
        description: 'The place name or address to geocode (e.g. "Science Museum, London" or "Eiffel Tower")',
      } as const,
    },
    required: ['query'],
  },
}

const reverseGeocodeTool: FunctionDeclaration = {
  name: 'reverseGeocode',
  description:
    'Look up the address or place name at given coordinates. Returns display name and structured address.',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      lat: {
        type: SchemaType.NUMBER,
        description: 'Latitude',
      } as const,
      lng: {
        type: SchemaType.NUMBER,
        description: 'Longitude',
      } as const,
    },
    required: ['lat', 'lng'],
  },
}

const searchPlacesTool: FunctionDeclaration = {
  name: 'searchPlaces',
  description:
    'Search for nearby places/POIs (restaurants, museums, parks, shops, etc.) around a location. Uses OpenStreetMap data. Returns up to 20 results with names, coordinates, and tags.',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      query: {
        type: SchemaType.STRING,
        description:
          'What to search for — can be a place type (e.g. "restaurant", "museum", "toilet", "pharmacy") or a name',
      } as const,
      lat: {
        type: SchemaType.NUMBER,
        description: 'Latitude of the center point to search around',
      } as const,
      lng: {
        type: SchemaType.NUMBER,
        description: 'Longitude of the center point to search around',
      } as const,
      radiusMeters: {
        type: SchemaType.NUMBER,
        description: 'Search radius in meters (default 1000, max 5000)',
      } as const,
    },
    required: ['query', 'lat', 'lng'],
  },
}

const calculateRouteTool: FunctionDeclaration = {
  name: 'calculateRoute',
  description:
    'Calculate a route between two points following actual roads/paths. Auto-selects the best transport mode based on distance (walking <3km, cycling 3-15km, driving >15km) unless specified. Returns distance and duration metadata. The route geometry is automatically added to the map.',
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
          'Optional transport mode: "walking", "driving", or "cycling". Only set if the user explicitly requests a specific mode.',
      } as const,
      properties: {
        type: SchemaType.STRING,
        description: 'JSON string with route properties: { title, description, color? }',
      } as const,
    },
    required: ['startLng', 'startLat', 'endLng', 'endLat'],
  },
}

// ── Exports ──────────────────────────────────────────────────────────────────

export const ALL_TOOL_DECLARATIONS: FunctionDeclaration[] = [
  // Data tools
  geocodeTool,
  reverseGeocodeTool,
  searchPlacesTool,
  calculateRouteTool,
  // Action tools
  addMapElementTool,
  updateMapElementTool,
  removeMapElementTool,
  setMapViewTool,
]
