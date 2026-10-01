import { flattenStyle, renderAtom, 기본테마 } from '../../../components/__tests__/render-atom'
import { AppointmentTimeBand, type AppointmentTimeBandProps } from '../AppointmentTimeBand'

function props(overrides: Partial<AppointmentTimeBandProps>): AppointmentTimeBandProps {
  return {
    todayKey: '2026-10-01',
    startDateKey: '2026-10-01',
    startMinutes: 21 * 60,
    endDateKey: '2026-10-01',
    endMinutes: 22 * 60,
    endInvalid: false,
    onChangeStart: jest.fn(),
    onChangeEnd: jest.fn(),
    ...overrides,
  }
}

describe('AppointmentTimeBand', () => {
  it('타일 넷에 라벨을 단다', async () => {
    const { getByText } = await renderAtom(<AppointmentTimeBand {...props({})} />)

    for (const label of ['시작 날짜', '시작 시각', '종료 날짜', '종료 시각']) {
      expect(getByText(label)).toBeTruthy()
    }
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

  it('종료가 틀리면 주황보다 빨강이 앞선다', async () => {
    const { getByText } = await renderAtom(
      <AppointmentTimeBand {...props({ endMinutes: 20 * 60, endInvalid: true })} />,
    )

    expect(flattenStyle(getByText('20:00').props.style).color).toBe(기본테마.errorInk)
  })
})
