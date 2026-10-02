// 알림을 눌러 연 약속. 그 회차가 든 주와 회차를 다시 찾는다.
import { findNotifiedOccurrence, parsePartyNotificationData, usePartyAppointmentOpenStore } from '../open-request'
import type { PartyAppointment } from '../../../types/party-appointment'

const weekly: PartyAppointment = {
  id: 'w1',
  bosses: [{ bossKey: 'limbo', difficulty: 'hard', ocid: 'ocid-1' }],
  members: [],
  timeKst: '21:00',
  durationMinutes: 30,
  leadMinutes: 10,
  schedule: { type: 'weekly', weekday: 4, fromWeek: '2026-10-01', untilWeek: null },
  exceptions: {},
}

describe('parsePartyNotificationData', () => {
  it('파티 약속 알림의 data 면 약속 id 와 회차 날짜를 낸다', () => {
    expect(
      parsePartyNotificationData({ kind: 'party-appointment', appointmentId: 'w1', dateKey: '2026-10-08' }),
    ).toEqual({ appointmentId: 'w1', dateKey: '2026-10-08' })
  })

  it('다른 종류이거나 칸이 빠졌으면 null 이다', () => {
    expect(parsePartyNotificationData({ kind: 'notice', appointmentId: 'w1', dateKey: '2026-10-08' })).toBeNull()
    expect(parsePartyNotificationData({ kind: 'party-appointment', appointmentId: 'w1' })).toBeNull()
  })
})

describe('findNotifiedOccurrence', () => {
  it('그 회차가 든 리셋 주와 회차를 찾는다', () => {
    const found = findNotifiedOccurrence([weekly], { appointmentId: 'w1', dateKey: '2026-10-15' })

    expect(found.weekStart).toBe('2026-10-15')
    expect(found.occurrence?.dateKey).toBe('2026-10-15')
    expect(found.occurrence?.appointment.id).toBe('w1')
  })

  it('수요일 회차는 앞 목요일에 시작하는 주다', () => {
    const wednesday = { ...weekly, schedule: { ...weekly.schedule, weekday: 3 } } as PartyAppointment

    expect(findNotifiedOccurrence([wednesday], { appointmentId: 'w1', dateKey: '2026-10-07' }).weekStart).toBe(
      '2026-10-01',
    )
  })

  // 알림이 울린 뒤 약속을 지웠으면 그 주 목록만 연다.
  it('약속이 없으면 회차는 없고 주만 낸다', () => {
    const found = findNotifiedOccurrence([], { appointmentId: 'w1', dateKey: '2026-10-08' })

    expect(found).toEqual({ weekStart: '2026-10-08', occurrence: undefined })
  })
})

describe('usePartyAppointmentOpenStore', () => {
  beforeEach(() => usePartyAppointmentOpenStore.setState({ request: null }))

  it('요청을 들고 있다가 비운다', () => {
    usePartyAppointmentOpenStore.getState().open({ appointmentId: 'w1', dateKey: '2026-10-08' })
    expect(usePartyAppointmentOpenStore.getState().request).toEqual({ appointmentId: 'w1', dateKey: '2026-10-08' })

    usePartyAppointmentOpenStore.getState().clear()
    expect(usePartyAppointmentOpenStore.getState().request).toBeNull()
  })
})
