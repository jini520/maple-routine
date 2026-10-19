// 호출부 21곳이 보던 카드가 그대로여야 한다.
//
// 코어가 4토큰뿐이라 얇아 보이지만, 그 4개가 `design-system.md` `기본 컴포넌트`절의 카드 정의
// 그대로다. 특히 `rounded-[14px]` 를 한곳에 모으는 것이 요점. 디자인 원칙 2가 "컴포넌트 성격별로
// 라운딩을 다르게"(카드 14px· 버튼 pill· 인풋 10px)라고 못박았으므로, 21곳에 흩어진 채로는
// 카드 라운딩이 조용히 어긋날 수 있다.

import { flattenStyle, renderAtom } from '../../../__tests__/render-atom'
import { Card } from '../Card'

describe('Card', () => {
  it('className은 코어 뒤에 이어 붙는다. 여백·간격은 호출부가 소유한다', async () => {
    const { getByTestId } = await renderAtom(<Card testID="card" className="gap-2 p-6" />)

    expect(flattenStyle(getByTestId('card').props.style)).toMatchObject({
      borderRadius: 14,
      padding: 24,
      rowGap: 8,
      columnGap: 8,
    })
  })

  it('미디어 카드도 같은 코어 위에 얹는다. 높이·클리핑만 호출부가 더한다', async () => {
    const { getByTestId } = await renderAtom(
      <Card testID="card" className="relative h-20 overflow-hidden" />,
    )

    expect(flattenStyle(getByTestId('card').props.style)).toMatchObject({
      borderRadius: 14,
      height: 80,
      overflow: 'hidden',
    })
  })

})
