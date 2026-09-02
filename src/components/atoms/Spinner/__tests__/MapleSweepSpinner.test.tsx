// 웹판의 다섯이 전부 산다(숨김 · `size` · clipPath 자식은 도형뿐 · id 충돌 없음 · motion-reduce).
// 다섯째는 **보는 방법이 바뀌었다**. 클래스 문자열이 없어 *"반복 애니메이션을 걸었는가"* 를 본다
// (`reduced-motion.ts` 의 `withRepeatSpy` 주석). 이동 거리·지속시간·이징을 웹 원본과 대조하던
// `keyframes-parity.test.ts` 는 웹 소스와 함께 지워져 지금 그 셋을 보는
// 곳은 없다.
//
// 여기에 RN 에서 새로 생긴 계약 하나가 더해진다: **띠의 색이 `currentColor`, 페이드가 마스크**라는 것.
// 웹처럼 그라디언트 정지점에 `currentColor` 를 쓰면 `react-native-svg` 가 경고만 찍고 그라디언트를
// **비운다**. 색 없는 띠는 조용한 실패라, 되돌아가는 것을 여기서 막는다(컴포넌트 주석 ①).
jest.mock('react-native-reanimated', () =>
  // `jest.mock` 팩토리는 import 위로 끌어올려져 **밖의 값을 참조할 수 없다**. 그래서 `require` 가
  // 선택이 아니라 이 길뿐이다(`reduced-motion.ts` `쓰는 법`).
  require('../../../__tests__/reduced-motion').reanimatedWithReducedMotion(),
)

import { mockReducedMotion, withRepeatSpy } from '../../../__tests__/reduced-motion'
import { findAllOfType, renderAtom, type TreeNode, 기본테마 } from '../../../__tests__/render-atom'
import { MapleSweepSpinner } from '../MapleSweepSpinner'

const HIDDEN = { includeHiddenElements: true } as const

afterEach(() => {
  mockReducedMotion(false)
  withRepeatSpy.mockClear()
})

/** 띠(마스크를 무는 쪽)와 램프(마스크 안 쪽)를 가른다. 둘 다 `RNSVGRect` 라 프롭으로 나눈다. */
function bandAndRamp(tree: unknown): { band?: TreeNode; ramp?: TreeNode } {
  const rects = findAllOfType(tree, 'RNSVGRect')
  return {
    band: rects.find((rect) => rect.props.mask !== undefined),
    ramp: rects.find((rect) => rect.props.mask === undefined),
  }
}

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

  // ★ 회귀 가드 — **띠가 마스크에 지워지던 결함.**
  //
  // 이식 당시 마스크는 `maskUnits`·`maskContentUnits` 를 **둘 다 `objectBoundingBox`** 로 두고
  // 램프를 `<Rect x=0 y=0 width=1 height=1>` 로 적었다. 그런데 `react-native-svg`(15.15.4)는
  // **`maskContentUnits` 를 렌더 시 읽지 않는다**. 안드로이드 `RenderableView.java` 도 iOS
  // `RNSVGRenderable.mm` 도 `maskUnits` 만 본다. 그래서 그 램프가 **1×1 픽셀**로 그려지고,
  // 마스크가 사실상 투명해져 `DST_IN` 이 띠를 통째로 지웠다. 실기기에서 **띠가 한 번도 보인 적이
  // 없었다**(두 플랫폼 다, 2026-08-18).
  //
  // 그 실패는 **렌더 트리에서 보이지 않는다**(마스크도 램프도 **있다**). 보이는 것은 **좌표의 단위**뿐이라
  // 여기서 그것을 못 박는다: 램프는 user space 이고 띠와 **같은 크기**여야 한다.
  it('마스크 램프는 user space 좌표다 — 1×1 이면 라이브러리가 띠를 통째로 지운다', async () => {
    const tree = (await renderAtom(<MapleSweepSpinner />)).toJSON()

    const { band, ramp } = bandAndRamp(tree)
    expect(ramp?.props.width).toBe(band?.props.width)
    expect(ramp?.props.height).toBe(band?.props.height)
    // `1` 은 objectBoundingBox 비율일 때만 뜻이 있는 값이고, 이 라이브러리에서는 그냥 1px 이다.
    expect(ramp?.props.width).not.toBe(1)
  })

  // 램프가 제자리에 서 있으면 **고정된 창으로 내다보는** 그림이 된다(띠만 그 아래를 지나간다).
  // 둘이 같은 shared value 에서 파생되므로 **시작 좌표가 같다**는 것으로 그 계약을 본다.
  it('램프가 띠와 같은 자리에서 시작한다 — 함께 움직인다', async () => {
    const tree = (await renderAtom(<MapleSweepSpinner />)).toJSON()

    const { band, ramp } = bandAndRamp(tree)
    expect(ramp?.props.y).toBe(band?.props.y)
  })
})

describe('MapleSweepSpinner — 모션 줄이기', () => {
  it('켜져 있으면 애니메이션을 아예 걸지 않는다 — 웹의 `motion-reduce:animate-none`', async () => {
    mockReducedMotion(true)

    const tree = (await renderAtom(<MapleSweepSpinner />)).toJSON()

    expect(withRepeatSpy).not.toHaveBeenCalled()
    // 띠가 시작 위치(잎 아래·viewBox 밖)에 머물러 **바탕 잎만** 남는다. 웹에서 `animation: none` 이
    // 보여주던 그림 그대로다. 이 좌표는 렌더 트리에 남으므로 여기서 볼 수 있다.
    const band = findAllOfType(tree, 'RNSVGRect').find((rect) => rect.props.mask !== undefined)
    expect(band?.props.y).toBe(140)
  })

  it('꺼져 있으면 되감기 없이 무한 반복한다 — 웹의 `infinite`(alternate 가 아니다)', async () => {
    await renderAtom(<MapleSweepSpinner />)

    expect(withRepeatSpy).toHaveBeenCalledTimes(1)
    expect(withRepeatSpy.mock.calls[0].slice(1)).toEqual([-1, false])
  })
})
