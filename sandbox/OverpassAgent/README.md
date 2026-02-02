# Overpass QL Agent

A CLI agent that takes a natural language prompt, uses Gemini to generate [Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API) queries, runs them, and writes the results as GeoJSON for viewing on a MapLibre map.

## Setup

Install dependencies:

```bash
npm install
```

Create a `.env` file with your Gemini API key:

```
GEMINI_API_KEY=your-key-here
```

## Usage

```bash
npx tsx agent.ts "<your query>"
```

Examples:

```bash
npx tsx agent.ts "Find all pubs near Big Ben in London"
npx tsx agent.ts "toilets near the Science Museum in London"
npx tsx agent.ts "castles in Wales"
```

The agent will:

1. Send your prompt to Gemini to generate an Overpass QL query
2. Run the query against the Overpass API
3. If the query fails or returns no results, retry with a corrected query (up to 5 attempts)
4. Write the results to `data.geojson`
5. Print a summary of what was found

## Viewing results

Serve the directory and open `index.html`:

```bash
npx serve .
```

The Leaflet map will load `data.geojson`, fit the view to the results, and show circle markers. Click a marker to see its name and tags.
