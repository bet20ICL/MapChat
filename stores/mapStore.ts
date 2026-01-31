import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { MapElement, MapViewState } from '@/types'

interface MapState {
  elements: MapElement[]
  selectedElementId: string | null
  viewState: MapViewState

  // Actions
  addElement: (element: MapElement) => void
  addElements: (elements: MapElement[]) => void
  updateElement: (id: string, updates: Partial<MapElement>) => void
  removeElement: (id: string) => void
  clearElements: () => void
  setSelectedElement: (id: string | null) => void
  setViewState: (viewState: Partial<MapViewState>) => void
  setElements: (elements: MapElement[]) => void
}

const defaultViewState: MapViewState = {
  longitude: -0.1276,
  latitude: 51.5074,
  zoom: 10,
  pitch: 0,
  bearing: 0,
}

export const useMapStore = create<MapState>()(
  persist(
    (set) => ({
      elements: [],
      selectedElementId: null,
      viewState: defaultViewState,

      addElement: (element) =>
        set((state) => ({
          elements: [...state.elements, element],
        })),

      addElements: (elements) =>
        set((state) => ({
          elements: [...state.elements, ...elements],
        })),

      updateElement: (id, updates) =>
        set((state) => ({
          elements: state.elements.map((el) =>
            el.id === id ? ({ ...el, ...updates } as MapElement) : el,
          ),
        })),

      removeElement: (id) =>
        set((state) => ({
          elements: state.elements.filter((el) => el.id !== id),
          selectedElementId: state.selectedElementId === id ? null : state.selectedElementId,
        })),

      clearElements: () =>
        set({
          elements: [],
          selectedElementId: null,
        }),

      setSelectedElement: (id) =>
        set({
          selectedElementId: id,
        }),

      setViewState: (viewState) =>
        set((state) => ({
          viewState: { ...state.viewState, ...viewState },
        })),

      setElements: (elements) =>
        set({
          elements,
          selectedElementId: null,
        }),
    }),
    {
      name: 'mapchat-map-store',
    },
  ),
)
