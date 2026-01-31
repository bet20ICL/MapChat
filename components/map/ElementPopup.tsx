'use client'

import { useMemo } from 'react'
import { Popup } from 'react-map-gl/maplibre'
import { useMapStore } from '@/stores/mapStore'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { X, ExternalLink } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import type { PinElement, ArcElement, AreaElement, RouteElement, LineElement } from '@/types'

function getElementCoordinates(
  element: PinElement | AreaElement | RouteElement | LineElement | ArcElement,
): [number, number] {
  switch (element.type) {
    case 'pin':
      return element.coordinates
    case 'arc':
      // Return midpoint of arc
      return [
        (element.source[0] + element.target[0]) / 2,
        (element.source[1] + element.target[1]) / 2,
      ]
    case 'area':
      // Return centroid of first ring
      const ring = element.coordinates[0]
      const sumLng = ring.reduce((acc, coord) => acc + coord[0], 0)
      const sumLat = ring.reduce((acc, coord) => acc + coord[1], 0)
      return [sumLng / ring.length, sumLat / ring.length]
    case 'route':
    case 'line':
      // Return midpoint of line
      const midIndex = Math.floor(element.coordinates.length / 2)
      return element.coordinates[midIndex]
    default:
      return [0, 0]
  }
}

export function ElementPopup() {
  const { elements, selectedElementId, setSelectedElement } = useMapStore()

  const selectedElement = useMemo(
    () => elements.find((el) => el.id === selectedElementId),
    [elements, selectedElementId],
  )

  if (!selectedElement) return null

  const coordinates = getElementCoordinates(selectedElement)

  return (
    <Popup
      longitude={coordinates[0]}
      latitude={coordinates[1]}
      anchor="bottom"
      onClose={() => setSelectedElement(null)}
      closeButton={false}
      maxWidth="400px"
      className="map-popup"
    >
      <div className="bg-background rounded-lg shadow-lg border max-w-sm">
        <div className="flex items-start justify-between p-3 border-b">
          <h3 className="font-semibold text-lg pr-2">{selectedElement.title}</h3>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={() => setSelectedElement(null)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <ScrollArea className="max-h-64">
          <div className="p-3 space-y-3">
            <p className="text-sm text-muted-foreground">{selectedElement.description}</p>

            {selectedElement.article && (
              <div className="space-y-2">
                <h4 className="font-medium text-sm">{selectedElement.article.title}</h4>
                <div className="text-sm prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown>{selectedElement.article.content}</ReactMarkdown>
                </div>
                {selectedElement.article.sources && selectedElement.article.sources.length > 0 && (
                  <div className="pt-2 border-t">
                    <p className="text-xs text-muted-foreground mb-1">Sources:</p>
                    <div className="flex flex-wrap gap-1">
                      {selectedElement.article.sources.map((source, i) => (
                        <a
                          key={i}
                          href={source}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline flex items-center gap-1"
                        >
                          <ExternalLink className="h-3 w-3" />
                          {new URL(source).hostname}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {selectedElement.timeRange && (
              <div className="text-xs text-muted-foreground">
                <span>Date: {selectedElement.timeRange.start}</span>
                {selectedElement.timeRange.end && <span> - {selectedElement.timeRange.end}</span>}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </Popup>
  )
}
