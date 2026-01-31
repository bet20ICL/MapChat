'use client'

import { ReactNode, useState } from 'react'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { Header, type ViewMode } from './Header'

interface AppLayoutProps {
  mapPanel: ReactNode
  chatPanel: ReactNode
  timelinePanel: ReactNode
}

export function AppLayout({ mapPanel, chatPanel, timelinePanel }: AppLayoutProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('split')

  return (
    <div className="flex flex-col h-screen">
      <Header viewMode={viewMode} onViewModeChange={setViewMode} />
      <div className="flex-1 flex flex-col overflow-hidden">
        {viewMode === 'split' && (
          <ResizablePanelGroup orientation="horizontal" className="flex-1">
            <ResizablePanel defaultSize={60} minSize={30}>
              <div className="h-full flex flex-col">
                <div className="flex-1 relative">{mapPanel}</div>
                <div className="border-t">{timelinePanel}</div>
              </div>
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={40} minSize={25}>
              {chatPanel}
            </ResizablePanel>
          </ResizablePanelGroup>
        )}
        {viewMode === 'map' && (
          <div className="flex-1 flex flex-col">
            <div className="flex-1 relative">{mapPanel}</div>
            <div className="border-t">{timelinePanel}</div>
          </div>
        )}
        {viewMode === 'chat' && <div className="flex-1">{chatPanel}</div>}
      </div>
    </div>
  )
}
