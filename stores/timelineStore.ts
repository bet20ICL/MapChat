import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface TimelineState {
  startDate: string | null // ISO date string
  endDate: string | null // ISO date string
  isEnabled: boolean

  // Actions
  setRange: (start: string | null, end: string | null) => void
  setEnabled: (enabled: boolean) => void
  reset: () => void
}

export const useTimelineStore = create<TimelineState>()(
  persist(
    (set) => ({
      startDate: null,
      endDate: null,
      isEnabled: false,

      setRange: (start, end) =>
        set({
          startDate: start,
          endDate: end,
        }),

      setEnabled: (enabled) =>
        set({
          isEnabled: enabled,
        }),

      reset: () =>
        set({
          startDate: null,
          endDate: null,
          isEnabled: false,
        }),
    }),
    {
      name: 'mapchat-timeline-store',
    },
  ),
)
