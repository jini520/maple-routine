import { create } from 'zustand'
import { getTrackedCharacterOcids } from '../../storage/character-selection'
import { getTrackingMode, setTrackingMode, type TrackingMode } from '../../storage/tracking-mode'
import { seedManualTrackedContent } from './seed'

export interface TrackingModeStore {
  mode: TrackingMode
  restoreFromStorage(): Promise<void>
  setMode(mode: TrackingMode): Promise<void>
}

export const useTrackingModeStore = create<TrackingModeStore>()((set, get) => ({
  mode: 'auto',

  async restoreFromStorage() {
    // 미선택(null)이어도 화면 동작은 자동이다. 골랐는가 를 구분해야 하는 곳은 온보딩 게이트뿐이고
    // 거기서는 저장 값을 직접 읽는다.
    set({ mode: (await getTrackingMode()) ?? 'auto' })
  },

  // auto → manual 전환 순간, 그 시점에 추적 중인 캐릭터 전원을 일괄 시드한다. 반환 Promise 는
  // 시드가 전부 끝난 뒤에만 resolve 된다. 호출부가 그것을 await 하며 로딩을 유지한다.
  //
  // 일괄은 목록 전체를 한 번에 넘기는 것이다. 캐릭터마다 시드를 동시에 부르면 단일 비행에
  // 서로 합류해 전원이 첫 캐릭터의 스케줄로 시드된다.
  async setMode(mode: TrackingMode) {
    const previousMode = get().mode
    await setTrackingMode(mode)
    set({ mode })

    if (mode === 'manual' && previousMode !== 'manual') {
      await seedManualTrackedContent((await getTrackedCharacterOcids()) ?? [])
    }
  },
}))
