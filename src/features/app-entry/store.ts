/**
 * 앱 진입 게이트. 지금 어느 화면이 서 있는가 하나를 든다.
 *
 * **인증과 축이 다르다.** 로그인 여부는 `features/auth` 가 들고, 이 스토어는 그 위에 캐릭터를
 * 골랐는가를 더해 화면을 정한다. 축을 하나로 합치면 넥슨 프렌즈 승급으로 로그인 방식이 바뀔 때
 * 캐릭터 설정 단계까지 같은 열거형에서 함께 흔들린다.
 *
 * **부르는 방향은 한쪽이다.** `features/auth` 가 로그인·로그아웃 뒤 이 스토어를 부른다. 이쪽에서
 * 인증을 부르지 않는다.
 */
import { create } from 'zustand'

import {
  getTrackedCharacterOcids,
  setTrackedCharacterOcids,
} from '../../storage/character-selection'
import type { MapleAccount } from '../../types'
import { seedManualTrackedContent } from '../tracking-mode/seed'
import { useTrackingModeStore } from '../tracking-mode/store'
import { deriveEntryStage, type EntryStage } from './stage'

export interface AppEntryState {
  stage: EntryStage
}

/** 부팅 직후. 저장소를 아직 안 읽었으므로 가장 앞 단계에 선다. */
export const initialAppEntryState: AppEntryState = { stage: 'signIn' }

export interface AppEntryStore extends AppEntryState {
  /** 부팅. 저장된 값에서 단계를 파생한다. */
  resolveFromStorage(): Promise<void>
  /** 로그인 직후. 저장된 목록이 이 키의 것인지까지 본다. */
  resolveAfterSignIn(accounts: MapleAccount[]): Promise<void>
  /**
   * 고른 캐릭터를 저장하고 앱을 연다. 앱에서 직접 체크하는 모드면 저장한 캐릭터 전원을 시드한다.
   *
   * @param onSeedStart 시드가 실제로 시작될 때 한 번. 화면이 대기 표시를 CTA 에서 전체 화면으로
   *   바꾸는 신호다. 자동 모드에서는 시드가 없어 안 불린다.
   */
  completeCharacterSetup(ocids: string[], onSeedStart?: () => void): Promise<void>
  /** 로그아웃. 화면을 로그인으로 되돌린다. */
  reset(): void
}

export const useAppEntryStore = create<AppEntryStore>()((set) => ({
  ...initialAppEntryState,

  async resolveFromStorage() {
    set({ stage: await deriveEntryStage() })
  },

  async resolveAfterSignIn(accounts) {
    const stage = await deriveEntryStage()

    // setApiKey 직후라 정상적으로는 올 수 없다. 방어적으로 캐릭터 설정에 떨어뜨린다.
    if (stage === 'signIn') {
      set({ stage: 'characterSetup' })
      return
    }

    // 계정을 고르지 않으므로 대조할 저장된 계정이 없다. 가드의 목적은 그대로다(남의 계정 키로
    // 이전 목록을 쓰게 두지 않는다). 같은 응답으로 추적 ocid 를 대조한다.
    //
    // 지킬 목록이 없으면 판정 대상 자체가 없다.
    const trackedOcids = (await getTrackedCharacterOcids()) ?? []
    if (trackedOcids.length === 0) {
      set({ stage })
      return
    }

    // 계정을 넘어 고르는 것이 이 설계의 본론이라, 겹치는 ocid가 어느 계정에 있는지는 묻지 않는다.
    const ocidsInResponse = new Set(
      accounts.flatMap((candidate) => candidate.characters.map((character) => character.ocid)),
    )
    if (trackedOcids.some((ocid) => ocidsInResponse.has(ocid))) {
      set({ stage })
      return
    }

    // 하나도 없다. 이 키는 다른 넥슨 계정의 것이다. 캐릭터부터 다시 고르게 한다.
    set({ stage: 'characterSetup' })
  },

  async completeCharacterSetup(ocids, onSeedStart) {
    await setTrackedCharacterOcids(ocids)

    if (useTrackingModeStore.getState().mode === 'manual') {
      onSeedStart?.()
      await seedManualTrackedContent(ocids)
    }

    set({ stage: 'ready' })
  },

  reset() {
    set({ stage: 'signIn' })
  },
}))
