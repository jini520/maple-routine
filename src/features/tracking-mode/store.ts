import { create } from 'zustand'
import { getTrackingMode, setTrackingMode, type TrackingMode } from '../../storage/tracking-mode'

export interface TrackingModeStore {
  mode: TrackingMode
  restoreFromStorage(): Promise<void>
  setMode(mode: TrackingMode): Promise<void>
}

export const useTrackingModeStore = create<TrackingModeStore>()((set) => ({
  mode: 'auto',

  async restoreFromStorage() {
    const mode = await getTrackingMode()
    set({ mode })
  },

  async setMode(mode: TrackingMode) {
    await setTrackingMode(mode)
    set({ mode })
  },
}))
