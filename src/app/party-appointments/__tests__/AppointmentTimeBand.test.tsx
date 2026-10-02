import { fireEvent } from '@testing-library/react-native'

import { flattenStyle, renderAtom, 기본테마 } from '../../../components/__tests__/render-atom'
import { AppointmentTimeBand, type AppointmentTimeBandProps } from '../AppointmentTimeBand'

function props(overrides: Partial<AppointmentTimeBandProps>): AppointmentTimeBandProps {
  return {
    todayKey: '2026-10-01',
    startDateKey: '2026-10-01',
    startMinutes: 21 * 60,
    endMinutes: 22 * 60,
    endInvalid: false,
    onChangeStart: jest.fn(),
    onChangeEnd: jest.fn(),
    ...overrides,
  }
}

describe('AppointmentTimeBand', () => {
  it('날짜 · 시작 · 종료 세 칸이다. 종료 날짜 칸은 없다', async () => {
    const { getByText, queryByText } = await renderAtom(<AppointmentTimeBand {...props({})} />)

    for (const label of ['날짜', '시작', '종료']) {
      expect(getByText(label)).toBeTruthy()
    }
    expect(queryByText('종료 날짜')).toBeNull()
  })

  it('같은 날 끝나면 날짜 칸은 시작 날짜 하나다', async () => {
    const { queryByText } = await renderAtom(<AppointmentTimeBand {...props({})} />)

    expect(queryByText(/10\/2/)).toBeNull()
  })

  it('종료가 시작보다 이르면 날짜 칸이 다음 날까지 적고, 종료는 시계 그대로다', async () => {
    const { getByText } = await renderAtom(
      <AppointmentTimeBand {...props({ startMinutes: 23 * 60 + 30, endMinutes: 30 })} />,
    )

    expect(getByText(/10\/2/)).toBeTruthy()
    expect(getByText('00:30')).toBeTruthy()
  })

  it('추가 · 수정에서는 바꿀 수 있는 값을 주황으로 쓴다', async () => {
    const { getByText } = await renderAtom(<AppointmentTimeBand {...props({})} />)

    expect(flattenStyle(getByText('21:00').props.style).color).toBe(기본테마.primaryInk)
  })

  it('상세의 읽기 모드는 값을 검게 쓰고 누를 수 없다', async () => {
    const { getByText, getByLabelText } = await renderAtom(<AppointmentTimeBand {...props({ readOnly: true })} />)

    expect(flattenStyle(getByText('21:00').props.style).color).toBe(기본테마.text)
    expect(getByLabelText('시작 시각 고르기').props.accessibilityState).toMatchObject({ disabled: true })
  })

  it('종료가 시작과 같으면 주황보다 빨강이 앞선다', async () => {
    const { getAllByText } = await renderAtom(
      <AppointmentTimeBand {...props({ endMinutes: 21 * 60, endInvalid: true })} />,
    )

    const end = getAllByText('21:00')[1]!
    expect(flattenStyle(end.props.style).color).toBe(기본테마.errorInk)
  })
})

// 반복 약속은 날짜가 아니라 요일을 고른다. 시트에는 날짜를 적지 않는다(사용자 결정).
describe('AppointmentTimeBand: 요일 타일', () => {
  const 목요일 = { startDateKey: '2026-10-08', onChangeWeekday: jest.fn() }

  it('날짜 타일 대신 요일 타일이 서고, 날짜는 어디에도 없다', async () => {
    const { getByText, queryByLabelText, queryByText } = await renderAtom(<AppointmentTimeBand {...props(목요일)} />)

    expect(getByText('매주 목요일')).toBeTruthy()
    expect(queryByLabelText('날짜 고르기')).toBeNull()
    expect(queryByText(/10\/8/)).toBeNull()
  })

  it('요일은 목요일부터 수요일까지 리셋 주 순서다', async () => {
    const { getAllByRole } = await renderAtom(<AppointmentTimeBand {...props(목요일)} />)

    const 요일 = getAllByRole('button')
      .map((node) => node.props.accessibilityLabel as string)
      .filter((label) => /^.요일$/.test(label))
    expect(요일).toEqual(['목요일', '금요일', '토요일', '일요일', '월요일', '화요일', '수요일'])
  })

  it('요일을 누르면 확인 없이 바로 알린다', async () => {
    const onChangeWeekday = jest.fn()
    const { getByLabelText } = await renderAtom(<AppointmentTimeBand {...props({ ...목요일, onChangeWeekday })} />)

    await fireEvent.press(getByLabelText('금요일'))

    expect(onChangeWeekday).toHaveBeenCalledWith(5)
  })

  it('고른 요일은 선택된 것으로 읽힌다', async () => {
    const { getByLabelText } = await renderAtom(<AppointmentTimeBand {...props(목요일)} />)

    expect(getByLabelText('목요일').props.accessibilityState).toMatchObject({ selected: true })
    expect(getByLabelText('금요일').props.accessibilityState).toMatchObject({ selected: false })
  })

  it('자정을 넘으면 값이 다음 요일까지 적힌다', async () => {
    const { getByText } = await renderAtom(
      <AppointmentTimeBand {...props({ ...목요일, startMinutes: 23 * 60 + 30, endMinutes: 30 })} />,
    )

    expect(getByText('매주 목 ~ 금요일')).toBeTruthy()
  })

  // 자정을 넘으면 상자가 다음 요일까지 한 알약으로 늘어난다. 두 칸 모두 상자 위 흰 글자다.
  it('자정을 넘으면 다음 요일 글자도 상자 위 흰 글자다', async () => {
    const { getByText } = await renderAtom(
      <AppointmentTimeBand {...props({ ...목요일, startMinutes: 23 * 60 + 30, endMinutes: 30 })} />,
    )

    expect(flattenStyle(getByText('금').props.style).color).toBe(기본테마.onPrimary)
    expect(flattenStyle(getByText('토').props.style).color).toBe(기본테마.text)
  })

  it('이웃한 두 칸이면 상자 하나가 둘을 덮는다', async () => {
    const { getAllByTestId } = await renderAtom(
      <AppointmentTimeBand {...props({ ...목요일, startMinutes: 23 * 60 + 30, endMinutes: 30 })} />,
    )

    expect(getAllByTestId(/^weekday-thumb/)).toHaveLength(1)
  })

  // 끝 칸 수요일에서 다음 날 목요일은 줄의 반대쪽 끝이라 이웃이 아니다. 양쪽에 상자를 하나씩 둔다.
  it('수요일에서 목요일로 넘어가면 양 끝에 상자를 하나씩 둔다', async () => {
    const { getAllByTestId, getByText } = await renderAtom(
      <AppointmentTimeBand
        {...props({ startDateKey: '2026-10-07', onChangeWeekday: jest.fn(), startMinutes: 23 * 60 + 30, endMinutes: 30 })}
      />,
    )

    expect(getAllByTestId(/^weekday-thumb/)).toHaveLength(2)
    expect(flattenStyle(getByText('목').props.style).color).toBe(기본테마.onPrimary)
  })

  it('같은 날 끝나면 상자는 하나, 다음 요일은 보통 글자다', async () => {
    const { getAllByTestId, getByText } = await renderAtom(<AppointmentTimeBand {...props(목요일)} />)

    expect(getAllByTestId(/^weekday-thumb/)).toHaveLength(1)
    expect(flattenStyle(getByText('금').props.style).color).toBe(기본테마.text)
  })
})
