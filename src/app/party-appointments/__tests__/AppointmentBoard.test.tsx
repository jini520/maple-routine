import { fireEvent, within } from '@testing-library/react-native'

import { renderAtom } from '../../../components/__tests__/render-atom'
import { occurrencesInWeek } from '../../../features/party-appointments/occurrences'
import { weekTimeline } from '../../../features/party-appointments/timeline'
import type { PartyAppointment } from '../../../types/party-appointment'
import { AppointmentBoard, type AppointmentBoardProps } from '../AppointmentBoard'

function once(id: string, dateKey: string, timeKst: string): PartyAppointment {
  return {
    id,
    bosses: [{ bossKey: 'limbo', difficulty: 'hard', ocid: 'ocid-1' }],
    members: [],
    timeKst,
    durationMinutes: 60,
    leadMinutes: null,
    schedule: { type: 'once', dateKey },
    exceptions: {},
  }
}

// 2026-10-22 는 목요일이고 그 리셋 주의 시작이다. 지금은 토요일 10/24 18:40(KST).
const WEEK = '2026-10-22'
const NOW = Date.parse('2026-10-24T18:40:00+09:00')

function props(appointments: PartyAppointment[], overrides: Partial<AppointmentBoardProps> = {}): AppointmentBoardProps {
  return {
    days: weekTimeline(occurrencesInWeek(appointments, WEEK), WEEK, NOW, null),
    todayKey: '2026-10-24',
    weekLabel: '이번 주',
    nowMs: NOW,
    names: new Map([['ocid-1', '낟낟']]),
    onPressOccurrence: jest.fn(),
    ...overrides,
  }
}

describe('AppointmentBoard', () => {
  it('요일 일곱 열이고, 열 머리에 회차 수를 적고, 빈 열은 스케줄 없음이다', async () => {
    const view = await renderAtom(
      <AppointmentBoard {...props([once('a', '2026-10-24', '21:00'), once('b', '2026-10-24', '23:00')])} />,
    )

    const lanes = view.getAllByTestId('board-lane')
    expect(lanes).toHaveLength(7)
    expect(within(lanes[2]!).getByText('2개')).toBeTruthy()
    expect(within(lanes[2]!).getAllByTestId('occurrence-card')).toHaveLength(2)
    expect(within(lanes[0]!).getByText('스케줄 없음')).toBeTruthy()
  })

  it('자정을 넘는 회차는 시작 날 열에만 카드가 서고, 다음 날 열 머리 줄에는 남은 부분이 막대로 선다', async () => {
    const view = await renderAtom(<AppointmentBoard {...props([once('a', '2026-10-24', '23:30')])} />)

    const lanes = view.getAllByTestId('board-lane')
    expect(within(lanes[3]!).queryAllByTestId('occurrence-card')).toHaveLength(0)
    expect(within(lanes[3]!).getAllByTestId('board-strip-bar')).toHaveLength(1)
  })

  it('지금 선은 오늘 열의 머리 줄에만 있다', async () => {
    const view = await renderAtom(<AppointmentBoard {...props([once('a', '2026-10-25', '21:00')])} />)

    expect(view.getAllByTestId('board-strip-now')).toHaveLength(1)
  })

  it('그 주에 스케줄이 하나도 없으면 열 대신 빈 상태다', async () => {
    const view = await renderAtom(<AppointmentBoard {...props([])} />)

    expect(view.queryAllByTestId('board-lane')).toHaveLength(0)
    expect(view.getByText('이번 주 파티 스케줄이 없어요')).toBeTruthy()
  })

  it('카드를 누르면 그 회차로 부른다', async () => {
    const onPressOccurrence = jest.fn()
    const view = await renderAtom(<AppointmentBoard {...props([once('a', '2026-10-24', '21:00')], { onPressOccurrence })} />)

    await fireEvent.press(view.getByTestId('occurrence-card'))

    expect(onPressOccurrence).toHaveBeenCalledWith(expect.objectContaining({ dateKey: '2026-10-24' }))
  })
})
