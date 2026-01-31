// JSON Schema for structured output from Gemini

export const MAP_ELEMENTS_SCHEMA = {
  type: 'object',
  properties: {
    elements: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          type: { type: 'string', enum: ['pin', 'area', 'route', 'arc', 'line'] },
          title: { type: 'string' },
          description: { type: 'string' },
          visible: { type: 'boolean' },
          color: { type: 'string' },
          coordinates: {
            oneOf: [
              { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 },
              { type: 'array', items: { type: 'array', items: { type: 'number' } } },
              {
                type: 'array',
                items: { type: 'array', items: { type: 'array', items: { type: 'number' } } },
              },
            ],
          },
          source: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 },
          target: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 },
          timeRange: {
            type: 'object',
            properties: {
              start: { type: 'string' },
              end: { type: 'string' },
            },
            required: ['start'],
          },
          article: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              content: { type: 'string' },
              images: { type: 'array', items: { type: 'string' } },
              sources: { type: 'array', items: { type: 'string' } },
            },
            required: ['title', 'content'],
          },
        },
        required: ['id', 'type', 'title', 'description', 'visible'],
      },
    },
    summary: { type: 'string' },
    suggestedViewState: {
      type: 'object',
      properties: {
        longitude: { type: 'number' },
        latitude: { type: 'number' },
        zoom: { type: 'number' },
      },
      required: ['longitude', 'latitude', 'zoom'],
    },
  },
  required: ['elements', 'summary'],
} as const
