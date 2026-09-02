// 잎은 **아이콘처럼 쓰이지만 lucide 규격은 아닌** 자리다. 그 둘을 다 지키는지
// 본다 — 호출부 프롭은 아이콘과 같고, 칠은 lucide 프리셋을 안 받는다.
import Settings from 'lucide-react-native/icons/settings'

import { findAllOfType, flattenStyle, renderAtom, 기본테마 } from '../../../__tests__/render-atom'
import { MapleLeaf } from '../MapleLeaf'
import { LEAF_GRID } from '../maple-leaf'

describe('MapleLeaf', () => {
  it('잎 격자로 선다 — 정사각이 아니다', async () => {
    const { getByTestId } = await renderAtom(<MapleLeaf size={42} />)

    const leaf = getByTestId('maple-leaf', { includeHiddenElements: true })
    expect(leaf.props.vbWidth).toBe(127)
    expect(leaf.props.vbHeight).toBe(130)
    expect(leaf.props.width).toBe(42)
    // 42 × 130/127 = 42.99. `EmptyState` 가 43 을 손으로 박아 두던 값이다.
    expect(leaf.props.height).toBeCloseTo(42 * LEAF_GRID.ratio, 10)
  })

  // **여기가 이 컴포넌트가 `IconSvg` 를 못 쓰는 이유다.** lucide 프리셋은 뿌리에 stroke 를 두는데
  // 그것은 상속 속성이라, 채운 잎에 2px 윤곽선이 얹힌다.
  it('뿌리에 선 프리셋이 없다 — 채운 잎에 윤곽선이 생기면 안 된다', async () => {
    const leaf = (await renderAtom(<MapleLeaf />)).getByTestId('maple-leaf', {
      includeHiddenElements: true,
    })
    const 아이콘 = findAllOfType((await renderAtom(<Settings />)).toJSON(), 'RNSVGSvgView')[0]

    expect(아이콘?.props.strokeWidth).toBeDefined()
    expect(leaf.props.strokeWidth).toBeUndefined()
    expect(leaf.props.stroke).toBeUndefined()
  })

  it('색은 className 이 정한다 — 아이콘과 같은 경로다', async () => {
    const { getByTestId } = await renderAtom(<MapleLeaf className="text-primary-ink" />)

    expect(getByTestId('maple-leaf', { includeHiddenElements: true }).props.color).toBe(
      기본테마.primaryInk,
    )
  })

  it('클래스를 못 쓰는 자리는 fill 을 값으로 준다', async () => {
    const tree = (await renderAtom(<MapleLeaf fill="#8A5A2B" />)).toJSON()

    expect(findAllOfType(tree, 'RNSVGPath')[0]?.props.fill).toMatchObject({ payload: expect.anything() })
  })

  it('크기 유틸이 size 기본값을 덮는다', async () => {
    const { getByTestId } = await renderAtom(<MapleLeaf className="h-5 w-5" />)

    expect(flattenStyle(getByTestId('maple-leaf', { includeHiddenElements: true }).props.style)).toMatchObject({
      width: 20,
      height: 20,
    })
  })
})
