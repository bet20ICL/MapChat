# MapChat

An AI-powered interactive map application that lets you explore geographic locations, historical events, and places of interest through natural conversation.

## Features

- **Interactive Map**: MapLibre-based 2D map with pins, areas, routes, lines, and arcs
- **AI Chat**: Gemini-powered conversational interface for exploring locations
- **Timeline Filtering**: Filter map elements by date range
- **Persistence**: Auto-saves to localStorage; export/import sessions as JSON
- **Resizable Panels**: Adjustable split-pane layout

## Screenshots

The app consists of:

- Left panel: Interactive map with OpenFreeMap tiles
- Right panel: AI chat interface
- Bottom: Timeline slider for temporal filtering

## Installation

### Prerequisites

- Node.js 18+
- npm or yarn
- Gemini API key (get one free at https://makersuite.google.com/app/apikey)

### Setup

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd MapChat
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure environment variables**

   Create a `.env.local` file in the project root:

   ```bash
   # Gemini API Key
   GEMINI_API_KEY=your_api_key_here
   ```

4. **Start the development server**

   ```bash
   npm run dev
   ```

5. **Open in browser**

   Navigate to http://localhost:3000

## Development

### Available Scripts

| Command         | Description                              |
| --------------- | ---------------------------------------- |
| `npm run dev`   | Start development server with hot reload |
| `npm run build` | Build for production                     |
| `npm run start` | Start production server                  |
| `npm run lint`  | Run ESLint                               |

### Project Structure

```
mapchat/
├── app/                    # Next.js App Router pages and API routes
│   ├── api/chat/          # Chat API endpoint
│   ├── api/generate-elements/  # Map element generation endpoint
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Main page
│   └── globals.css        # Global styles
├── components/            # React components
│   ├── chat/             # Chat UI components
│   ├── map/              # Map components
│   ├── timeline/         # Timeline components
│   ├── layout/           # Layout components
│   └── ui/               # shadcn/ui components
├── lib/                   # Utilities and providers
│   ├── llm/              # LLM provider (Gemini)
│   └── utils/            # Helper functions
├── stores/               # Zustand state stores
├── types/                # TypeScript type definitions
└── public/               # Static assets
```

### Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **Map**: MapLibre GL JS via react-map-gl
- **Tiles**: OpenFreeMap (free, no API key needed)
- **AI**: Google Gemini API
- **State**: Zustand with localStorage persistence
- **Layout**: react-resizable-panels

### Adding New Map Element Types

1. Add type definition in `types/map-elements.ts`
2. Update `MapLayers.tsx` to render the new type
3. Update `lib/llm/prompts.ts` to include the new type in AI generation

### Swapping LLM Providers

1. Create a new provider in `lib/llm/` implementing the `LLMProvider` interface
2. Update the API routes in `app/api/` to use the new provider
3. Add any required environment variables

## Usage

### Example Prompts

- "Show me famous landmarks in Paris"
- "Map the route of the Silk Road"
- "Where did major battles of World War II take place?"
- "Show me the Seven Wonders of the Ancient World"
- "Display the journey of Marco Polo"

### Keyboard Shortcuts

- `Enter` - Send message
- Click on map elements to see details
- Drag the panel divider to resize

### Export/Import

- Click **Export** in the header to save your session as JSON
- Click **Import** to load a previously saved session
- Click **Clear** to reset the map and chat

## API Reference

### POST /api/chat

Send a chat message and receive a conversational response.

```typescript
// Request
{
  "messages": [
    { "role": "user", "content": "Hello" }
  ]
}

// Response
{
  "content": "Hello! I'm MapChat..."
}
```

### POST /api/generate-elements

Generate map elements from a natural language prompt.

```typescript
// Request
{
  "prompt": "Show me the Eiffel Tower"
}

// Response
{
  "elements": [...],
  "summary": "Added pin for Eiffel Tower",
  "suggestedViewState": {
    "longitude": 2.2945,
    "latitude": 48.8584,
    "zoom": 15
  }
}
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT

## Acknowledgments

- [MapLibre GL JS](https://maplibre.org/) - Open-source map rendering
- [OpenFreeMap](https://openfreemap.org/) - Free map tiles
- [Google Gemini](https://ai.google.dev/) - AI language model
- [shadcn/ui](https://ui.shadcn.com/) - UI components
