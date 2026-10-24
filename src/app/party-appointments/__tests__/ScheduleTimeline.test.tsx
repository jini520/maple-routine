import { fireEvent, within } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'

import { renderAtom } from '../../../components/__tests__/render-atom'
import { occurrencesInWeek } from '../../../features/party-appointments/occurrences'
import { weekTimeline } from '../../../features/party-appointments/timeline'
import type { PartyAppointment } from '../../../types/party-appointment'
import { ScheduleTimeline, type ScheduleTimelineProps } from '../ScheduleTimeline'

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

function props(appointments: PartyAppointment[], overrides: Partial<ScheduleTimelineProps> = {}): ScheduleTimelineProps {
  return {
    days: weekTimeline(occurrencesInWeek(appointments, WEEK), WEEK, NOW, null),
    todayKey: '2026-10-24',
    onPressSegment: jest.fn(),
    ...overrides,
  }
}

describe('ScheduleTimeline', () => {
  it('처음에는 오늘 한 줄로 접혀 있고, 펼치면 요일 일곱 줄, 다시 접으면 오늘 한 줄이다', async () => {
    const view = await renderAtom(<ScheduleTimeline {...props([])} />)

    expect(view.getByText('오늘 시간표')).toBeTruthy()
    expect(view.getAllByTestId('timeline-row')).toHaveLength(1)

    await fireEvent.press(view.getByRole('button', { name: '주간 시간표 펼치기' }))
    expect(view.getByText('주간 시간표')).toBeTruthy()
    expect(view.getAllByTestId('timeline-row')).toHaveLength(7)

    await fireEvent.press(view.getByRole('button', { name: '주간 시간표 접기' }))
    expect(view.getAllByTestId('timeline-row')).toHaveLength(1)
  })

  it('오늘 회차가 없어도 빈 오늘 줄과 지금 선을 그린다', async () => {
    const view = await renderAtom(<ScheduleTimeline {...props([once('a', '2026-10-25', '21:00')])} />)

    expect(view.queryAllByTestId('timeline-bar')).toHaveLength(0)
    expect(view.getAllByTestId('timeline-now')).toHaveLength(1)
  })

  it('펼쳐도 지금 선은 오늘 줄에만 하나다', async () => {
    const view = await renderAtom(<ScheduleTimeline {...props([])} />)
    await fireEvent.press(view.getByRole('button', { name: '주간 시간표 펼치기' }))

    expect(view.getAllByTestId('timeline-now')).toHaveLength(1)
  })

  // 오늘 줄의 바탕은 불투명한 primary-tint 라 카드 전체에 깐 3시간 띠를 가린다. 그 줄에만 띠를 다시 그린다.
  it('3시간 띠가 오늘 줄에도 보이고, 다른 줄에는 따로 그리지 않는다', async () => {
    const view = await renderAtom(<ScheduleTimeline {...props([])} />)
    await fireEvent.press(view.getByRole('button', { name: '주간 시간표 펼치기' }))

    const counts = view.getAllByTestId('timeline-row').map((row) => within(row).queryAllByTestId('timeline-row-band').length)
    expect(counts).toEqual([0, 0, 4, 0, 0, 0, 0])
  })

  // 앱에는 뾰족한 모서리를 두지 않는다(사용자 지정). 띠와 지금 선은 모서리가 각진 사각형으로 그리기 쉬운 자리다.
  it('카드의 띠 · 오늘 줄 안의 띠 · 지금 선은 모서리가 둥글다', async () => {
    const view = await renderAtom(<ScheduleTimeline {...props([])} />)

    const pieces = [
      ...view.getAllByTestId('timeline-band'),
      ...view.getAllByTestId('timeline-row-band'),
      ...view.getAllByTestId('timeline-now'),
    ]
    expect(pieces.length).toBeGreaterThan(0)
    for (const piece of pieces) {
      expect(StyleSheet.flatten(piece.props.style)?.borderRadius ?? 0).toBeGreaterThan(0)
    }
  })

  it('막대를 누르면 그 회차의 열쇠로 부른다', async () => {
    const onPressSegment = jest.fn()
    const view = await renderAtom(
      <ScheduleTimeline {...props([once('a', '2026-10-24', '21:00')], { onPressSegment })} />,
    )

    await fireEvent.press(view.getByTestId('timeline-bar'))

    expect(onPressSegment).toHaveBeenCalledWith('a:2026-10-24')
  })

  it('오늘이 없는 다른 주는 접을 줄이 없어 펼친 채로 보인다', async () => {
    const view = await renderAtom(<ScheduleTimeline {...props([], { todayKey: '2026-10-31' })} />)

    expect(view.getAllByTestId('timeline-row')).toHaveLength(7)
    expect(view.queryByRole('button', { name: '주간 시간표 접기' })).toBeNull()
  })
})
