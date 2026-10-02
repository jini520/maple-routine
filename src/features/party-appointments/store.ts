/**
 * 파티 약속 목록을 드는 스토어. 화면은 이것을 구독하고, 바꿀 때는 `save` 로 저장소와 함께 바꾼다.
 */
import { create } from 'zustand'

import { getPartyAppointments, setPartyAppointments } from '../../storage/party-appointments'
import { requestNotificationReconcile } from '../local-notifications/run'
import type { PartyAppointment } from '../../types/party-appointment'

interface PartyAppointmentsState {
  appointments: PartyAppointment[]
  /** 저장소를 한 번이라도 읽었나. 읽기 전의 빈 목록을 `약속 없음` 으로 그리지 않게 */
  loaded: boolean
  load: () => Promise<void>
  save: (next: PartyAppointment[]) => Promise<void>
}

export const usePartyAppointmentsStore = create<PartyAppointmentsState>()((set) => ({
  appointments: [],
  loaded: false,

  async load() {
    set({ appointments: await getPartyAppointments(), loaded: true })
  },

  async save(next) {
    // 저장이 먼저다. 저장이 실패했는데 화면만 바뀌면 다시 켰을 때 약속이 사라진다.
    await setPartyAppointments(next)
    set({ appointments: next, loaded: true })
    // 재조정은 저장소를 읽으니 저장 뒤에 부른다.
    void requestNotificationReconcile()
  },
}))
