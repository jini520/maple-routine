// 약속 시트. 한 번 · 반복은 ＋ 의 갈래에서 정해지고, 시트에는 그것을 바꾸는 칸이 없다.
import type { ReactNode } from 'react'
import { act, fireEvent } from '@testing-library/react-native'

// 시트 라이브러리를 맨 뷰로 바꾼다. 여기서 보는 것은 시트 안에 무엇이 서는가다.
jest.mock('@gorhom/bottom-sheet', () => {
  const ReactNative = jest.requireActual<typeof import('react-native')>('react-native')
  const React = jest.requireActual<typeof import('react')>('react')

  return {
    BottomSheetBackdrop: (props: Record<string, unknown>) => React.createElement(ReactNative.View, props),
    BottomSheetModal: React.forwardRef((props: Record<string, unknown>, ref: unknown) => {
      React.useImperativeHandle(ref as never, () => ({ present: jest.fn(), dismiss: jest.fn() }))
      return React.createElement(ReactNative.View, props)
    }),
    BottomSheetScrollView: (props: Record<string, unknown>) => React.createElement(ReactNative.View, props),
    useBottomSheetTimingConfigs: (config: unknown) => config,
    BottomSheetModalProvider: (props: { children: ReactNode }) => props.children,
  }
})

import { renderOverlay } from '../../../components/__tests__/render-atom'
import { occurrencesInWeek } from '../../../features/party-appointments/occurrences'
import type { PartyAppointment } from '../../../types/party-appointment'
import { AppointmentSheet } from '../AppointmentSheet'

const NAMES = new Map([['ocid-1', '낟낟']])

function 그리기(props: Partial<React.ComponentProps<typeof AppointmentSheet>> = {}) {
  return renderOverlay(<AppointmentSheet names={NAMES} colorOf={() => '#3F7FC4'} onClose={jest.fn()} {...props} />)
}

describe('추가 시트', () => {
  it('한 번만 갈래로 열면 제목이 약속 추가다', async () => {
    const view = await 그리기({ repeats: false })

    expect(view.getByText('약속 추가')).toBeTruthy()
  })

  it('매주 반복 갈래로 열면 제목이 반복 약속 추가다', async () => {
    const view = await 그리기({ repeats: true })

    expect(view.getByText('반복 약속 추가')).toBeTruthy()
  })

  it('한 번 약속은 날짜를 고른다', async () => {
    const view = await 그리기({ repeats: false })

    expect(view.getByLabelText('날짜 고르기')).toBeTruthy()
  })

  it('반복 약속은 날짜 대신 요일을 고르고, 알림 사용량도 요일로 적는다', async () => {
    const view = await 그리기({ repeats: true })

    expect(view.queryByLabelText('날짜 고르기')).toBeNull()
    expect(view.getByText(/^매주 .요일$/)).toBeTruthy()
    expect(view.getByText(/^.요일 알림 /)).toBeTruthy()
  })

  it('매주 반복 체크 상자가 없다', async () => {
    const view = await 그리기({ repeats: true })

    expect(view.queryByLabelText('매주 반복')).toBeNull()
  })
})

describe('수정 시트', () => {
  const weekly: PartyAppointment = {
    id: 'a1',
    bosses: [{ bossKey: 'limbo', difficulty: 'hard', ocid: 'ocid-1' }],
    members: [],
    timeKst: '21:00',
    durationMinutes: 30,
    leadMinutes: null,
    schedule: { type: 'weekly', weekday: 4, fromWeek: '2099-01-01', untilWeek: null },
    exceptions: {},
  }

  // 한 번 ↔ 반복은 수정에서 바꾸지 못한다. 바꾸려면 지우고 다시 추가한다.
  it('매주 반복 체크 상자가 없고, 제목은 약속 수정 그대로다', async () => {
    const [occurrence] = occurrencesInWeek([weekly], '2099-01-01')
    const view = await 그리기({ target: { occurrence: occurrence!, weekStart: '2099-01-01' } })

    await act(async () => {
      fireEvent.press(view.getByLabelText('수정'))
    })

    expect(view.getByText('약속 수정')).toBeTruthy()
    expect(view.queryByLabelText('매주 반복')).toBeNull()
    expect(view.getByLabelText('이 주만 적용하기')).toBeTruthy()
  })

  // 앞으로 모두는 그 주부터 모든 회차를 바꾸니 요일을, 이 주만은 그 회차 하나를 옮기니 날짜를 고른다.
  it('앞으로 모두는 요일, 이 주만 적용하기를 켜면 날짜다', async () => {
    const [occurrence] = occurrencesInWeek([weekly], '2099-01-01')
    const view = await 그리기({ target: { occurrence: occurrence!, weekStart: '2099-01-01' } })
    await act(async () => {
      fireEvent.press(view.getByLabelText('수정'))
    })

    expect(view.getByText('매주 목요일')).toBeTruthy()
    expect(view.queryByLabelText('날짜 고르기')).toBeNull()

    await act(async () => {
      fireEvent.press(view.getByLabelText('이 주만 적용하기'))
    })

    expect(view.getByLabelText('날짜 고르기')).toBeTruthy()
  })
})
