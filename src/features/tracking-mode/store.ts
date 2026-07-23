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

  // ADR-035 결정 14(a): auto → manual 전환 순간, 그 시점에 추적 중인 캐릭터 전원
  // (content+boss 합집합, 중복 제거)을 일괄 시드한다. 반환 Promise는 시드가 전부 끝난
  // 뒤에만 resolve된다 — 호출부가 이걸 await하며 로딩을 유지하면 결정 15의 "시드 완료
  // 전까지 로딩 유지"가 충족된다.
  async setMode(mode: TrackingMode) {
    const previousMode = get().mode
    await setTrackingMode(mode)
    set({ mode })

    if (mode === 'manual' && previousMode !== 'manual') {
      const [contentOcids, bossOcids] = await Promise.all([
        getTrackedCharacterOcids('content'),
        getTrackedCharacterOcids('boss'),
      ])
      const ocids = Array.from(new Set([...(contentOcids ?? []), ...(bossOcids ?? [])]))
      await Promise.all(ocids.map((ocid) => seedManualTrackedContent(ocid)))
    }
  },
}))
