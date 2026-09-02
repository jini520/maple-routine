import { create } from 'zustand'

import { useOnboardingStore } from '../onboarding/store'

/**
 * 설정 화면의 스토어 — 지금 남은 일은 **연결 해제 하나**다.
 *
 * 원래 이 스토어의 본체는 계정(메이플 ID) 변경 플로우였다(— 키 재조회 ·
 * 계정 선택 · 예열 · 캐릭터 재선택 커밋). 그 기능은 이 폐지했고(계정을 바꾸는
 * 일이 캐릭터 관리의 드롭다운 안으로 들어갔다), 화면들이 지워진 뒤로도 남아 있던 액션 넷
 * (`changeApiKey`·`refreshAccounts`·`selectAccount`·`commitAccountChange`)과 그 상태 기계
 * (`settings/state.ts`)는 **부르는 곳이 하나도 없었다.** 함께 지웠다.
 *
 * 연결 해제가 온보딩 스토어의 `reset()` 을 그대로 부르는 것은 예전과 같다. 지우는 대상이
 * 온보딩이 저장한 것들이라 진실이 한 곳에 있어야 한다.
 */
export interface SettingsStore {
  disconnect(): Promise<void>
}

export const useSettingsStore = create<SettingsStore>()(() => ({
  async disconnect() {
    await useOnboardingStore.getState().reset()
  },
}))
