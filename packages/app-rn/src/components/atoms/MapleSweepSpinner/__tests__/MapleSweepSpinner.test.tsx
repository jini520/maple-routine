// 웹판의 다섯 중 넷이 그대로 산다(숨김 · `size` · clipPath 자식은 도형뿐 · id 충돌 없음).
// "motion-reduce 클래스" 하나는 지킬 것이 없다 — 아직 모션이 없다(step 7).
//
// 대신 RN 에서 새로 생긴 계약 하나를 지킨다: **띠의 색이 `currentColor`, 페이드가 마스크**라는 것.
// 웹처럼 그라디언트 정지점에 `currentColor` 를 쓰면 `react-native-svg` 가 경고만 찍고 그라디언트를
// **비운다** — 색 없는 띠는 조용한 실패라, 되돌아가는 것을 여기서 막는다(컴포넌트 주석 ①).
import { findAllOfType, renderAtom, type TreeNode, 기본테마 } from '../../../__tests__/render-atom'
import { MapleSweepSpinner } from '../MapleSweepSpinner'

const HIDDEN = { includeHiddenElements: true } as const

function childTypes(node: TreeNode): string[] {
  return (node.children ?? [])
    .filter((child): child is TreeNode => typeof child !== 'string')
    .map((child) => child.type)
}

describe('MapleSweepSpinner', () => {
  it('장식용 아이콘이라 스크린리더에서 숨겨진다', async () => {
    const { getByTestId } = await renderAtom(<MapleSweepSpinner />)

    expect(getByTestId('maple-sweep-spinner', HIDDEN).props['aria-hidden']).toBe(true)
  })

  it('size prop으로 지정한 너비만큼 렌더링된다', async () => {
    const { getByTestId } = await renderAtom(<MapleSweepSpinner size={24} />)

    expect(getByTestId('maple-sweep-spinner', HIDDEN).props.width).toBe(24)
  })

  it('색은 className 이 정한다 — `currentColor` 가 읽는 `color` 프롭으로 들어간다', async () => {
    const { getByTestId } = await renderAtom(<MapleSweepSpinner className="text-text-muted" />)

    expect(getByTestId('maple-sweep-spinner', HIDDEN).props.color).toBe(기본테마.textMuted)
  })

  // 웹에서는 `<clipPath>` 안에 `<g>` 를 넣으면 Chrome 이 조용히 빈 클립을 만들어 잎이 사라졌다
  // (`MapleWaveProgress` 트랩). 같은 모양을 유지한다.
  it('clipPath의 직접 자식은 도형 요소(Path)뿐이다', async () => {
    const tree = (await renderAtom(<MapleSweepSpinner />)).toJSON()

    const [clip] = findAllOfType(tree, 'RNSVGClipPath')
    expect(childTypes(clip)).toEqual(['RNSVGPath'])
  })

  it('띠는 `currentColor` 로 칠하고 페이드는 마스크가 만든다 — 정지점에 currentColor 금지', async () => {
    const tree = (await renderAtom(<MapleSweepSpinner />)).toJSON()

    // 그라디언트가 실제로 만들어졌는지(= 정지점이 유효한 색인지) 본다. `currentColor` 였다면
    // `react-native-svg` 가 경고를 찍고 이 배열이 빈다.
    const [gradient] = findAllOfType(tree, 'RNSVGLinearGradient')
    expect((gradient.props.gradient as number[]).length).toBeGreaterThan(0)

    // 그리고 띠 자신은 마스크를 물고 `currentColor`(= fill type 2)로 칠해진다.
    const [mask] = findAllOfType(tree, 'RNSVGMask')
    const band = findAllOfType(tree, 'RNSVGRect').find((rect) => rect.props.mask !== undefined)
    expect(band?.props.mask).toBe(mask.props.name)
    expect(band?.props.fill).toEqual({ type: 2 })
  })

  // 같은 화면에 두 개가 놓여도 clipPath/gradient/mask id가 충돌하면 안 된다(useId 기반).
  it('여러 개를 렌더해도 id가 서로 다르다', async () => {
    const tree = (
      await renderAtom(
        <>
          <MapleSweepSpinner />
          <MapleSweepSpinner />
        </>,
      )
    ).toJSON()

    const [first, second] = findAllOfType(tree, 'RNSVGClipPath')
    expect(first.props.name).toBeDefined()
    expect(first.props.name).not.toEqual(second.props.name)
  })

  it('렌더 트리 스냅샷 — 이후 변경을 잡는 기준선(예전 화면과의 대조가 아니다)', async () => {
    expect(
      (await renderAtom(<MapleSweepSpinner className="text-primary" />)).toJSON(),
    ).toMatchSnapshot()
  })
})
