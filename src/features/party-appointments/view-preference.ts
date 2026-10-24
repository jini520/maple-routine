/**
 * 파티 스케줄 화면의 보기(목록 · 보드)를 드는 스토어. 고르면 기기에 적어 다음에도 그 보기로 연다.
 */
import { create } from 'zustand'

import { getPartyScheduleView, setPartyScheduleView, type PartyScheduleView } from '../../storage/party-schedule-view'

export type { PartyScheduleView }

export interface PartyScheduleViewState {
  view: PartyScheduleView
  /** 기기 값을 한 번이라도 읽었는가. 읽기 전에 그리면 보드를 고른 사용자에게 목록이 한 번 스친다 */
  loaded: boolean
  load: () => Promise<void>
  setView: (view: PartyScheduleView) => void
}

export const usePartyScheduleViewStore = create<PartyScheduleViewState>((set) => ({
  view: 'list',
  loaded: false,
  load: async () => {
    set({ view: await getPartyScheduleView(), loaded: true })
  },
  setView: (view) => {
    set({ view })
    void setPartyScheduleView(view)
  },
}))
