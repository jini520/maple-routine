// 옅은 원 안에 아이콘 하나를 둔 배지. 화면마다 직접 그리면 지름 · 아이콘 · 선 굵기가 갈려서 이 부품 하나로 그린다.
// 색 짝은 옅은 바탕 · 같은 계열의 진한 아이콘이고, `muted` 는 꺼진 타일의 회색 바탕 · 흐린 아이콘이다.
// 클래스 문자열은 트리에 남지 않으므로 풀린 값을 본다.
import Swords from 'lucide-react-native/icons/swords'

import { findAllOfType, flattenStyle, renderAtom, 기본테마 } from '../../../__tests__/render-atom'
import { withIconInterop } from '../../../../lib/nativewind-interop'
import { IconBadge } from '../IconBadge'

const SwordsIcon = withIconInterop(Swords)
const HIDDEN = { includeHiddenElements: true } as const

describe('IconBadge', () => {
  it.each([32, 40, 48, 64] as const)('지름 %i: 아이콘은 지름의 절반이고 선 굵기는 1.75 다', async (size) => {
    const view = await renderAtom(<IconBadge testID="badge" icon={SwordsIcon} size={size} />)

    expect(flattenStyle(view.getByTestId('badge').props.style)).toMatchObject({ width: size, height: size, borderRadius: 9999 })
    const [icon] = findAllOfType(view.toJSON(), 'RNSVGSvgView')
    expect(flattenStyle(icon.props.style)).toMatchObject({ width: size / 2, height: size / 2 })
    expect(icon.props.strokeWidth ?? findAllOfType(icon, 'RNSVGGroup')[0]?.props.strokeWidth).toBe(1.75)
  })

  it.each([
    ['primary', 'primaryTint', 'primaryInk'],
    ['secondary', 'secondaryTint', 'secondaryInk'],
    ['third', 'thirdTint', 'thirdInk'],
    ['error', 'errorTint', 'errorInk'],
    ['muted', 'surface2', 'textDisabled'],
  ] as const)('%s: 바탕과 아이콘이 같은 색 짝이다', async (tone, bg, ink) => {
    const view = await renderAtom(<IconBadge testID="badge" icon={SwordsIcon} size={40} tone={tone} />)

    expect(flattenStyle(view.getByTestId('badge').props.style).backgroundColor).toBe(기본테마[bg])
    const [icon] = findAllOfType(view.toJSON(), 'RNSVGSvgView')
    expect(icon.props.color ?? icon.props.stroke).toBe(기본테마[ink])
  })

  it('색을 안 주면 primary 다', async () => {
    const view = await renderAtom(<IconBadge testID="badge" icon={SwordsIcon} size={32} />)

    expect(flattenStyle(view.getByTestId('badge').props.style).backgroundColor).toBe(기본테마.primaryTint)
  })

  it('busy 면 아이콘 대신 지름 절반의 스피너가 돈다', async () => {
    const view = await renderAtom(<IconBadge testID="badge" icon={SwordsIcon} size={40} busy />)

    expect(flattenStyle(view.getByTestId('spinner', HIDDEN).props.style)).toMatchObject({ width: 20, height: 20 })
    expect(findAllOfType(view.toJSON(), 'RNSVGPath')).toHaveLength(0)
  })

  // `fill` 스타일이 RN 에 없어 색은 `text-*` → `color` 프롭 → 자식의 `currentColor` 로 흐른다. 이 통로가 끊기면 잎이 검게 된다.
  it('leaf 면 지름 절반의 단풍잎을 진한 글자색으로 그린다', async () => {
    const view = await renderAtom(<IconBadge testID="badge" icon="leaf" size={64} />)

    const leaf = view.getByTestId('maple-leaf', HIDDEN)
    expect(flattenStyle(leaf.props.style).width).toBe(32)
    expect(leaf.props.color).toBe(기본테마.primaryInk)
  })
})
