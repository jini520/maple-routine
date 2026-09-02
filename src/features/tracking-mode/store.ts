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
    // 미선택(null)이어도 화면 동작은 '자동'이다(유지). "골랐는가"를
    // 구분해야 하는 곳은 온보딩 게이트뿐이고, 거기서는 저장 값을 직접 읽는다.
    set({ mode: (await getTrackingMode()) ?? 'auto' })
  },

  // 결정 14(a): auto → manual 전환 순간, 그 시점에 추적 중인 캐릭터 전원을 일괄
  // 시드한다. 반환 Promise는 시드가 전부 끝난 뒤에만 resolve된다. 호출부가 이걸 await하며
  // 로딩을 유지하면 결정 15의 "시드 완료 전까지 로딩 유지"가 충족된다.
  // 로 추적 목록이 단일화되어 content+boss 합집합 계산이 사라졌다.
  // "일괄"이 목록 전체를 **한 번에 넘기는** 것이 됐다. 캐릭터마다 시드를 동시에
  // 부르던 옛 모양은 단일 비행에 서로 합류해 전원이 첫 캐릭터의 스케줄로 시드됐다.
  async setMode(mode: TrackingMode) {
    const previousMode = get().mode
    await setTrackingMode(mode)
    set({ mode })

    if (mode === 'manual' && previousMode !== 'manual') {
      await seedManualTrackedContent((await getTrackedCharacterOcids()) ?? [])
    }
  },
}))
