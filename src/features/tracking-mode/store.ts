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
    const mode = await getTrackingMode()
    set({ mode })
  },

  // ADR-035 결정 14(a): auto → manual 전환 순간, 그 시점에 추적 중인 캐릭터 전원을 일괄
  // 시드한다. 반환 Promise는 시드가 전부 끝난 뒤에만 resolve된다 — 호출부가 이걸 await하며
  // 로딩을 유지하면 결정 15의 "시드 완료 전까지 로딩 유지"가 충족된다.
  // ADR-042로 추적 목록이 단일화되어 content+boss 합집합 계산이 사라졌다.
  async setMode(mode: TrackingMode) {
    const previousMode = get().mode
    await setTrackingMode(mode)
    set({ mode })

    if (mode === 'manual' && previousMode !== 'manual') {
      const ocids = (await getTrackedCharacterOcids()) ?? []
      await Promise.all(ocids.map((ocid) => seedManualTrackedContent(ocid)))
    }
  },
}))
