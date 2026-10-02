import { fireEvent } from '@testing-library/react-native'

import { renderAtom } from '../../../components/__tests__/render-atom'
import { agendaDays } from '../../../features/party-appointments/agenda'
import { occurrencesInWeek } from '../../../features/party-appointments/occurrences'
import type { PartyAppointment } from '../../../types/party-appointment'
import { AppointmentAgenda, type AppointmentAgendaProps } from '../AppointmentAgenda'

function appointment(overrides: Partial<PartyAppointment>): PartyAppointment {
  return {
    id: 'a1',
    bosses: [{ bossKey: 'limbo', difficulty: 'hard', ocid: 'ocid-1' }],
    members: [],
    timeKst: '21:00',
    durationMinutes: 30,
    leadMinutes: null,
    schedule: { type: 'once', dateKey: '2026-10-01' },
    exceptions: {},
    ...overrides,
  }
}

const WEEK = '2026-10-01'
const NAMES = new Map([['ocid-1', '낟낟']])

function props(appointments: PartyAppointment[], overrides: Partial<AppointmentAgendaProps> = {}): AppointmentAgendaProps {
  return {
    days: agendaDays(occurrencesInWeek(appointments, WEEK)),
    todayKey: '2026-10-02',
    weekLabel: '이번 주',
    nowMs: Date.parse('2026-10-01T20:00:00Z'),
    names: NAMES,
    colorOf: () => '#3F7FC4',
    onPressOccurrence: jest.fn(),
    ...overrides,
  }
}

describe('AppointmentAgenda', () => {
  it('약속이 있는 날만 요일 머리를 세운다', async () => {
    const view = await renderAtom(
      <AppointmentAgenda
        {...props([appointment({}), appointment({ id: 'b', schedule: { type: 'once', dateKey: '2026-10-04' } })])}
      />,
    )

    expect(view.getByText('목')).toBeTruthy()
    expect(view.getByText('일')).toBeTruthy()
    expect(view.queryByText('금')).toBeNull()
  })

  it('시작과 ~종료, 보스와 캐릭터를 적는다', async () => {
    const view = await renderAtom(<AppointmentAgenda {...props([appointment({ timeKst: '23:30' })])} />)

    expect(view.getByText('23:30')).toBeTruthy()
    expect(view.getByText('~00:00')).toBeTruthy()
    expect(view.getByText('낟낟')).toBeTruthy()
  })

  it('알림 · 반복이 있으면 맨 아래 줄에 글자로 적는다', async () => {
    const weekly = appointment({
      leadMinutes: 10,
      schedule: { type: 'weekly', weekday: 4, fromWeek: WEEK, untilWeek: null },
    })
    const view = await renderAtom(<AppointmentAgenda {...props([weekly])} />)

    expect(view.getByText('10분 전')).toBeTruthy()
    expect(view.getByText('매주')).toBeTruthy()
  })

  it('알림 · 반복이 없으면 그 줄이 없다', async () => {
    const view = await renderAtom(<AppointmentAgenda {...props([appointment({})])} />)

    expect(view.queryByText('매주')).toBeNull()
    expect(view.queryByText(/분 전$/)).toBeNull()
  })

  it('약속을 누르면 그 회차로 부른다', async () => {
    const onPressOccurrence = jest.fn()
    const view = await renderAtom(<AppointmentAgenda {...props([appointment({})], { onPressOccurrence })} />)

    await fireEvent.press(view.getByText('21:00'))

    expect(onPressOccurrence).toHaveBeenCalledWith(expect.objectContaining({ dateKey: '2026-10-01' }))
  })

  // ＋ 가 같은 화면에 있어서 빈 상태에는 버튼을 두지 않는다(사용자 결정).
  it('약속이 없으면 그 주 이름의 빈 상태를 두고 버튼은 없다', async () => {
    const view = await renderAtom(<AppointmentAgenda {...props([], { weekLabel: '9월 1주차' })} />)

    expect(view.getByText('9월 1주차 약속이 없어요')).toBeTruthy()
    expect(view.queryByRole('button')).toBeNull()
  })
})
