import { create } from 'zustand'
import { getDropEffectEnabled, setDropEffectEnabled } from '@core/storage/drop-effect'

// 고가 아이템 드롭 연출 on/off 전역 상태(ADR-040 결정 6). 값은 어댑터(storage/drop-effect)로만
// 읽고 쓴다([[ADR-003]]). 시트 안 토글이 이 스토어를 구독·갱신하고, 부팅 시 restoreFromStorage로
// 저장값을 복원한다(테마 스토어 패턴 미러).

export interface DropEffectStore {
  enabled: boolean
  restoreFromStorage(): Promise<void>
  setEnabled(enabled: boolean): Promise<void>
}

export const useDropEffectStore = create<DropEffectStore>()((set) => ({
  enabled: true,

  async restoreFromStorage() {
    const enabled = await getDropEffectEnabled()
    set({ enabled })
  },

  async setEnabled(enabled: boolean) {
    await setDropEffectEnabled(enabled)
    set({ enabled })
  },
}))
