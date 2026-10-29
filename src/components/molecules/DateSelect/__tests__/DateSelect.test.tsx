import { getThemeDefinition } from '../../../../lib/theme/theme-registry'
import { resolveControlColors } from '../../../../theme/theme-vars'
import { findAllOfType, flattenStyle, renderOverlay } from '../../../__tests__/render-atom'
import { DateSelect } from '../DateSelect'

describe('DateSelect', () => {
  // 알약만 두면 값처럼 읽혀 아무도 안 누른다. 끝의 화살표가 `변경` 글자 대신 바꿀 수 있다는 것을 말한다.
  it('알약 끝에 아래 화살표가 서고 변경 글자는 없다', async () => {
    const view = await renderOverlay(<DateSelect dateKey="2026-09-18" label="잡은 날" onPress={jest.fn()} />)

    expect(view.queryByText('변경')).toBeNull()
    expect(view.getByText('9월 18일 (금)')).toBeTruthy()
    // 알약 안의 그림은 앞의 달력과 끝의 화살표 둘이다.
    expect(findAllOfType(view.toJSON(), 'RNSVGSvgView')).toHaveLength(2)
  })

  // 스테퍼 트랙과 같은 반투명 바탕이라 카드 · 칸 · 시트 어디에 놓여도 알약이 보인다.
  it('알약은 테두리 없이 control-track 으로 채운다', async () => {
    const view = await renderOverlay(<DateSelect dateKey="2026-09-18" label="잡은 날" onPress={jest.fn()} />)
    const pill = flattenStyle(view.getByTestId('date-select-pill').props.style)

    expect(pill.borderWidth).toBeUndefined()
    expect(pill.backgroundColor).toBe(resolveControlColors(getThemeDefinition('머쉬맘')).track)
  })
})
