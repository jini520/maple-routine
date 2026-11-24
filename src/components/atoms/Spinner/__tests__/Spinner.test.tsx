// 앱의 대기 표시는 이 링 하나다. 크기와 놓이는 바탕만 쓰는 곳마다 다르다.
//
// 쿼리에 `includeHiddenElements` 를 주는 것 자체가 `aria-hidden` 이 먹었다는 증거다. RNTL 은 숨긴 요소를 기본으로 찾지 않는다.
jest.mock('react-native-reanimated', () =>
  // `jest.mock` 팩토리는 import 위로 끌어올려져 밖의 값을 참조할 수 없어 `require` 로 가져온다.
  require('../../../__tests__/reduced-motion').reanimatedWithReducedMotion(),
)

import { mockReducedMotion, withRepeatSpy } from '../../../__tests__/reduced-motion'
import { findAllOfType, flattenStyle, renderAtom, 기본테마 } from '../../../__tests__/render-atom'
import { Spinner } from '../Spinner'

const HIDDEN = { includeHiddenElements: true } as const

afterEach(() => {
  mockReducedMotion(false)
  withRepeatSpy.mockClear()
})

/** 트랙과 호의 `Svg` · `Circle`. 트랙이 먼저 그려진다. */
async function 그려서(ui: React.JSX.Element) {
  const tree = (await renderAtom(ui)).toJSON()
  const [trackSvg, arcSvg] = findAllOfType(tree, 'RNSVGSvgView')
  const [track, arc] = findAllOfType(tree, 'RNSVGCircle')
  return { trackSvg, arcSvg, track, arc }
}

describe('Spinner', () => {
  it('준 크기의 상자를 차지하고 스크린리더에서 숨는다', async () => {
    const { getByTestId } = await renderAtom(<Spinner size={32} />)

    expect(flattenStyle(getByTestId('spinner', HIDDEN).props.style)).toMatchObject({ width: 32, height: 32 })
  })

  it('바탕 위: 호는 주 색이고 트랙은 호와 다른 색으로 흐리지 않고 칠한다', async () => {
    const { trackSvg, arcSvg, track } = await 그려서(<Spinner size={18} />)

    expect(arcSvg.props.color).toBe(기본테마.primary)
    expect(trackSvg.props.color).not.toBe(기본테마.primary)
    expect(track.props.strokeOpacity ?? 1).toBe(1)
  })

  it('호의 색은 className 이 정한다', async () => {
    const { arcSvg } = await 그려서(<Spinner size={18} className="text-on-primary" />)

    expect(arcSvg.props.color).toBe(기본테마.onPrimary)
  })

  // 버튼 바탕 위에서 `track` 은 회색 얼룩으로 보인다. 라벨 색 하나로 칠하고 트랙만 흐린다.
  it('버튼 안: 트랙도 호와 같은 색이고 30% 로 흐리다', async () => {
    const { trackSvg, arcSvg, track, arc } = await 그려서(<Spinner size={16} className="text-on-primary" inButton />)

    expect(trackSvg.props.color).toBe(기본테마.onPrimary)
    expect(arcSvg.props.color).toBe(기본테마.onPrimary)
    expect(track.props.strokeOpacity).toBe(0.3)
    expect(arc.props.strokeOpacity ?? 1).toBe(1)
  })

  // `react-native-svg` 에는 `pathLength` 정규화가 없어 대시를 실제 둘레로 계산한다. 반지름과 어긋나면 호 길이가 조용히 달라진다.
  it('호는 그려진 원 둘레의 4분의 1 이다', async () => {
    const { arc } = await 그려서(<Spinner size={18} />)

    const circumference = 2 * Math.PI * Number(arc.props.r)
    const [dash] = arc.props.strokeDasharray as number[]
    expect(dash / circumference).toBeCloseTo(0.25, 10)
  })
})

describe('Spinner: 모션 줄이기', () => {
  it('켜져 있으면 돌리지 않는다', async () => {
    mockReducedMotion(true)

    await renderAtom(<Spinner size={18} />)

    expect(withRepeatSpy).not.toHaveBeenCalled()
  })

  it('꺼져 있으면 되감기 없이 같은 방향으로 계속 돈다', async () => {
    await renderAtom(<Spinner size={18} />)

    expect(withRepeatSpy).toHaveBeenCalledTimes(1)
    expect(withRepeatSpy.mock.calls[0].slice(1)).toEqual([-1, false])
  })
})
