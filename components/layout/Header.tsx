'use client'

import { Button } from '@/components/ui/button'
import { useMapStore } from '@/stores/mapStore'
import { useChatStore } from '@/stores/chatStore'
import { useTimelineStore } from '@/stores/timelineStore'
import { Download, Upload, Trash2, Map, PlayCircle, Columns2, MessageSquare } from 'lucide-react'
import { toast } from 'sonner'

const DEMO_DATA = {
  elements: [
    {
      id: 'ww2_1',
      type: 'pin' as const,
      title: 'Invasion of Poland',
      description: 'The German invasion of Poland marked the start of World War II.',
      coordinates: [19.0399, 51.1079] as [number, number],
      visible: true,
      color: '#e74c3c',
      timeRange: { start: '1939-09-01' },
    },
    {
      id: 'ww2_2',
      type: 'pin' as const,
      title: 'Attack on Pearl Harbor',
      description: 'Surprise military strike by Japan on the US naval base in Hawaii.',
      coordinates: [-157.9677, 21.3651] as [number, number],
      visible: true,
      color: '#e74c3c',
      timeRange: { start: '1941-12-07' },
    },
    {
      id: 'ww2_3',
      type: 'pin' as const,
      title: 'Battle of Stalingrad',
      description: 'Major battle on the Eastern Front, a turning point in the war.',
      coordinates: [44.5182, 48.7071] as [number, number],
      visible: true,
      color: '#e74c3c',
      timeRange: { start: '1942-08-23', end: '1943-02-02' },
    },
    {
      id: 'ww2_4',
      type: 'pin' as const,
      title: 'D-Day (Normandy Landings)',
      description: 'Allied invasion of Normandy, the largest seaborne invasion in history.',
      coordinates: [-0.6265, 49.3428] as [number, number],
      visible: true,
      color: '#3498db',
      timeRange: { start: '1944-06-06' },
    },
    {
      id: 'ww2_5',
      type: 'pin' as const,
      title: 'Atomic Bombing of Hiroshima',
      description: 'The United States dropped an atomic bomb on Hiroshima, Japan.',
      coordinates: [132.4599, 34.3853] as [number, number],
      visible: true,
      color: '#9b59b6',
      timeRange: { start: '1945-08-06' },
    },
    {
      id: 'ww2_6',
      type: 'pin' as const,
      title: 'VE Day - Victory in Europe',
      description: 'Nazi Germany surrendered, ending World War II in Europe.',
      coordinates: [13.405, 52.52] as [number, number],
      visible: true,
      color: '#2ecc71',
      timeRange: { start: '1945-05-08' },
    },
  ],
  viewState: { longitude: 20, latitude: 45, zoom: 2 },
}

export type ViewMode = 'split' | 'map' | 'chat'

interface HeaderProps {
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
}

export function Header({ viewMode, onViewModeChange }: HeaderProps) {
  const { elements, setElements, clearElements, setViewState } = useMapStore()
  const { messages, setMessages, clearMessages } = useChatStore()
  const { reset: resetTimeline } = useTimelineStore()

  const handleExport = () => {
    const data = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      elements,
      messages,
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `mapchat-export-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Session exported successfully')
  }

  const handleImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      try {
        const text = await file.text()
        const data = JSON.parse(text)
        if (data.elements) setElements(data.elements)
        if (data.messages) setMessages(data.messages)
        toast.success('Session imported successfully')
      } catch (error) {
        toast.error('Failed to import session')
      }
    }
    input.click()
  }

  const handleClear = () => {
    clearElements()
    clearMessages()
    resetTimeline()
    toast.success('Session cleared')
  }

  const handleLoadDemo = () => {
    setElements(DEMO_DATA.elements)
    setViewState(DEMO_DATA.viewState)
    toast.success('Demo data loaded - try the timeline slider!')
  }

  return (
    <header className="flex items-center justify-between px-4 py-2 border-b bg-background">
      <div className="flex items-center gap-2">
        <Map className="h-6 w-6 text-primary" />
        <h1 className="text-xl font-semibold">MapChat</h1>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center border rounded-md">
          <Button
            variant={viewMode === 'map' ? 'default' : 'outline'}
            size="sm"
            className="rounded-r-none border-0"
            onClick={() => onViewModeChange('map')}
          >
            <Map className="h-4 w-4 mr-2" />
            Map
          </Button>
          <Button
            variant={viewMode === 'split' ? 'default' : 'outline'}
            size="sm"
            className="rounded-none border-0 border-x"
            onClick={() => onViewModeChange('split')}
          >
            <Columns2 className="h-4 w-4 mr-2" />
            Split
          </Button>
          <Button
            variant={viewMode === 'chat' ? 'default' : 'outline'}
            size="sm"
            className="rounded-l-none border-0"
            onClick={() => onViewModeChange('chat')}
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            Chat
          </Button>
        </div>

        <Button variant="default" size="sm" onClick={handleLoadDemo}>
          <PlayCircle className="h-4 w-4 mr-2" />
          Load Demo
        </Button>
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
        <Button variant="outline" size="sm" onClick={handleImport}>
          <Upload className="h-4 w-4 mr-2" />
          Import
        </Button>
        <Button variant="outline" size="sm" onClick={handleClear}>
          <Trash2 className="h-4 w-4 mr-2" />
          Clear
        </Button>
      </div>
    </header>
  )
}
