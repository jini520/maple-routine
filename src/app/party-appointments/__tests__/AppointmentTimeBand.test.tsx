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
