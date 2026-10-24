import { fireEvent } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'

import { renderAtom, 기본테마 } from '../../../components/__tests__/render-atom'
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
const NAMES = new Map([['ocid-1', '낟낟'], ['ocid-2', '낟넘']])

function props(appointments: PartyAppointment[], overrides: Partial<AppointmentAgendaProps> = {}): AppointmentAgendaProps {
  return {
    days: agendaDays(occurrencesInWeek(appointments, WEEK)),
    todayKey: '2026-10-02',
    weekLabel: '이번 주',
    nowMs: Date.parse('2026-10-01T20:00:00Z'),
    names: NAMES,
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
    // 시각은 카드 위 한 줄이다. 종료는 시작 옆에 `~ 종료` 로 붙는다(정정 19).
    expect(view.getByText('~ 00:00')).toBeTruthy()
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

  it('메모가 있으면 카드 맨 아래에 두 줄까지 적는다', async () => {
    const view = await renderAtom(<AppointmentAgenda {...props([appointment({ memo: '2번 방\n세렌 확인\n칼로스 신호' })])} />)

    expect(view.getByTestId('occurrence-card-memo').props.numberOfLines).toBe(2)
  })

  it('남은 시간은 오늘 아직 시작 전인 회차에만 붙는다', async () => {
    // 지금은 10/2(금) 05:00 KST 다.
    const today = appointment({ id: 't', schedule: { type: 'once', dateKey: '2026-10-02' } })
    const tomorrow = appointment({ id: 'n', schedule: { type: 'once', dateKey: '2026-10-03' } })
    const view = await renderAtom(<AppointmentAgenda {...props([today, tomorrow])} />)

    expect(view.getByText('16시간 뒤')).toBeTruthy()
    expect(view.queryAllByText(/뒤$/)).toHaveLength(1)
  })

  it('강조할 회차 카드만 강조 바탕이다', async () => {
    const view = await renderAtom(
      <AppointmentAgenda
        {...props([appointment({}), appointment({ id: 'b', timeKst: '22:00' })], { highlightedKey: 'b:2026-10-01' })}
      />,
    )

    const backgrounds = view
      .getAllByTestId('occurrence-card')
      .map((card) => StyleSheet.flatten(card.props.style)?.backgroundColor)
    expect(backgrounds).toEqual([기본테마.surface, 기본테마.primaryTint])
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

    expect(view.getByText('9월 1주차 파티 스케줄이 없어요')).toBeTruthy()
    expect(view.queryByRole('button')).toBeNull()
  })

  // 보스는 캐릭터별로 묶여 선다. 캐릭터 이름은 묶음 머리에 한 번만 적고 보스 줄에는 없다(정정 17).
  it('보스를 캐릭터를 처음 고른 순서로 묶고, 캐릭터 이름은 묶음마다 한 번 적는다', async () => {
    const view = await renderAtom(
      <AppointmentAgenda
        {...props([
          appointment({
            bosses: [
              { bossKey: 'limbo', difficulty: 'hard', ocid: 'ocid-1' },
              { bossKey: 'jupiter', difficulty: 'normal', ocid: 'ocid-2' },
              { bossKey: 'kaling', difficulty: 'normal', ocid: 'ocid-1' },
            ],
          }),
        ])}
      />,
    )

    expect(view.getAllByText('낟낟')).toHaveLength(1)
    expect(view.getAllByText('낟넘')).toHaveLength(1)
    const order = view.getAllByText(/^(낟낟|낟넘|림보|유피테르|카링)$/).map((node) => node.props.children)
    expect(order).toEqual(['낟낟', '림보', '카링', '낟넘', '유피테르'])
  })
})
