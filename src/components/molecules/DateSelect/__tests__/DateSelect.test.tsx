import { renderOverlay } from '../../../__tests__/render-atom'
import { DateSelect } from '../DateSelect'

describe('DateSelect', () => {
  it('기본은 변경 글자와 날짜 알약이 함께 선다', async () => {
    const view = await renderOverlay(<DateSelect dateKey="2026-09-18" label="잡은 날" onPress={jest.fn()} />)

    expect(view.getByText('변경')).toBeTruthy()
    expect(view.getByText('9월 18일 (금)')).toBeTruthy()
  })

  // 알약 자리가 이미 바꿀 수 있는 곳으로 읽히는 화면(통계 누적의 시작 날짜)은 글자를 끈다.
  it('변경 글자를 끄면 알약만 선다', async () => {
    const view = await renderOverlay(
      <DateSelect dateKey="2026-09-18" label="누적 시작 날짜" onPress={jest.fn()} showChangeLabel={false} />,
    )

    expect(view.queryByText('변경')).toBeNull()
    expect(view.getByText('9월 18일 (금)')).toBeTruthy()
  })
})
