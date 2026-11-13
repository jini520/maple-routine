// 하단바 인벤토리 탭의 배낭. 사용자가 고른 그림을 따라 그린 채운 아이콘이라, 꺼진 탭도 고른 탭도 채운 모양이어야 한다.
import { findAllOfType, renderAtom, 기본테마 } from '../../../__tests__/render-atom'
import { BackpackIcon } from '../BackpackIcon'

describe('BackpackIcon', () => {
  it('색은 className 이 정하고 그 색으로 채운다', async () => {
    const { getByTestId } = await renderAtom(<BackpackIcon className="text-primary" />)

    expect(getByTestId('backpack-icon').props.color).toBe(기본테마.primary)
  })

  // 하단바는 꺼진 탭에 `fill="none"` 을 넘긴다. 그대로 따르면 꺼진 탭의 배낭이 사라진다.
  it('하단바가 꺼진 탭에 넘기는 fill="none" 이어도 채운 모양 그대로다', async () => {
    const tree = (await renderAtom(<BackpackIcon fill="none" />)).toJSON()

    const paths = findAllOfType(tree, 'RNSVGPath')
    expect(paths.length).toBeGreaterThan(0)
    for (const path of paths) expect(path.props.fill).not.toBeNull()
  })

  it('앞주머니를 clipPath · mask 로 파지 않는다. 한 화면에 여러 번 그리면 id 가 겹친다', async () => {
    const tree = (await renderAtom(<BackpackIcon />)).toJSON()

    expect(findAllOfType(tree, 'RNSVGClipPath')).toHaveLength(0)
    expect(findAllOfType(tree, 'RNSVGMask')).toHaveLength(0)
  })
})
