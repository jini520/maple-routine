import { DROPDOWN_SHADOW } from '../shadow'
import { itemDelay, itemStartOffset, listShadowOf, listStartOffset } from '../dropdown-motion'

describe('드롭다운이 펼쳐지는 움직임', () => {
  // 가운데 기준으로 줄인 목록을 칸에 닿는 변 쪽으로 밀어 둔다. 아래로 열리면 위쪽 끝, 위로 열리면 아래쪽 끝이다.
  it('위로 열리면 목록이 아래로 밀린 채 시작해 아래쪽 끝에서 자라고, 아래로 열릴 때와 거리는 같다', () => {
    const 아래 = listStartOffset(200, 6, 'below')
    const 위 = listStartOffset(200, 6, 'above')

    expect(아래).toBeLessThan(0)
    expect(위).toBe(-아래)
  })

  it('보기는 아래로 열리면 위에서 내려오고, 위로 열리면 아래에서 올라온다', () => {
    expect(itemStartOffset('below')).toBeLessThan(0)
    expect(itemStartOffset('above')).toBe(-itemStartOffset('below'))
  })

  it('그림자는 아래로 열리면 아래로, 위로 열리면 위로 같은 거리만큼 진다', () => {
    expect(listShadowOf('below')).toEqual(DROPDOWN_SHADOW)
    expect(listShadowOf('above')).toEqual({ ...DROPDOWN_SHADOW, y: -DROPDOWN_SHADOW.y })
  })

  it('칸에 가까운 보기부터 나타난다. 위로 열리면 아래 보기가 먼저다', () => {
    const 차례 = (side: 'below' | 'above') => [0, 1, 2].map((index) => itemDelay(index, 3, side))

    expect(차례('below')).toEqual([0, 40, 80])
    expect(차례('above')).toEqual([80, 40, 0])
  })
})
