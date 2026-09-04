import { create } from 'zustand'

import { useAuthStore } from '../auth/store'

/**
 * 설정 화면의 스토어. 지금 남은 일은 연결 해제 하나다.
 *
 * 계정을 바꾸는 일이 캐릭터 관리의 드롭다운 안으로 들어가면서 계정 변경 플로우와 그 상태
 * 기계가 통째로 사라졌다.
 *
 * 연결 해제가 인증 스토어의 `signOut()` 을 그대로 부르는 것은 지우는 대상이 인증이 저장한
 * 것들이라 진실이 한 곳에 있어야 하기 때문이다.
 */
export interface SettingsStore {
  disconnect(): Promise<void>
}

export const useSettingsStore = create<SettingsStore>()(() => ({
  async disconnect() {
    await useAuthStore.getState().signOut()
  },
}))
