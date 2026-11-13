import { create } from 'zustand'
import { getOverFrameEnabled, setOverFrameEnabled } from '../../storage/over-frame'

/** 오버 프레임(머리를 원 밖으로 그리는 얼굴) 켜짐. 테마 페이지의 `적용` 이 바꾸고, 얼굴 부품(`CharacterAvatar`)이 읽는다. */
export interface OverFrameStore {
  enabled: boolean
  restoreFromStorage(): Promise<void>
  setEnabled(enabled: boolean): Promise<void>
}

export const useOverFrameStore = create<OverFrameStore>()((set) => ({
  enabled: true,

  async restoreFromStorage() {
    const enabled = await getOverFrameEnabled()
    set({ enabled })
  },

  async setEnabled(enabled: boolean) {
    await setOverFrameEnabled(enabled)
    set({ enabled })
  },
}))
