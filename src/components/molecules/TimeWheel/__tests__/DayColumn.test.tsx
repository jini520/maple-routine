// 시 휠 왼쪽의 날짜 열. 폭을 박지 않고 두 글자(당일 · 다음 날) 중 긴 것에 맞춘다.
import { flattenStyle, renderAtom } from '../../../__tests__/render-atom'
import { DayColumn } from '../DayColumn'

function 그리기(today: string, next: string) {
  return renderAtom(
    <DayColumn offset={null} boundary={1} today={today} next={next} itemHeight={32} pickerHeight={77} nearY={27} farY={39} />,
  )
}

describe('DayColumn', () => {
  // `금요일` 처럼 짧은 글자를 날짜(`10/2 (금)`)에 맞춘 고정 폭에 두면 왼쪽이 크게 빈다(사용자 지적).
  it('폭을 박지 않는다', async () => {
    const view = await 그리기('금요일', '토요일')

    expect(flattenStyle(view.getByTestId('day-column', { includeHiddenElements: true }).props.style).width).toBeUndefined()
  })

  it('두 글자를 모두 담은 자리 잡기 줄이 폭을 정한다', async () => {
    const view = await 그리기('10/2 (금)', '10/3 (토)')

    const sizer = view.getByTestId('day-column-sizer', { includeHiddenElements: true })
    expect(sizer.props.children).toHaveLength(2)
  })
})
