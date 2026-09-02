// 지키던 셋(장식용 숨김 · `size` 반영 · motion-reduce)이 전부 산다. 셋째는 **보는 방법이
// 바뀌었다**. `motion-reduce:animate-none` 클래스가 RN 에는
// 없어, *"반복 애니메이션을 걸었는가"* 를 본다(`reduced-motion.ts` 의 `withRepeatSpy` 주석).
//
// 계약이 하나 더 있다: `pathLength` 정규화가 없는 만큼 **대시가 실측 둘레의
// 70/30 이어야 한다**(컴포넌트 주석 참고). 지속시간·이징을 웹 원본과 대조하던
// `keyframes-parity.test.ts` 는 웹 소스와 함께 지워져 지금 그 둘을 보는
// 곳은 없다.
//
// 쿼리에 `includeHiddenElements` 를 주는 것 자체가 `aria-hidden` 이 먹었다는 증거다. RNTL 은 숨긴
// 요소를 기본적으로 못 찾는다(플래그를 빼면 첫 케이스가 "찾을 수 없다"로 떨어진다, 실측).
jest.mock('react-native-reanimated', () =>
  // `jest.mock` 팩토리는 import 위로 끌어올려져 **밖의 값을 참조할 수 없다**. 그래서 `require` 가
  // 선택이 아니라 이 길뿐이다(`reduced-motion.ts` `쓰는 법`).
  require('../../../__tests__/reduced-motion').reanimatedWithReducedMotion(),
)

import { mockReducedMotion, withRepeatSpy } from '../../../__tests__/reduced-motion'
import { findAllOfType, flattenStyle, renderAtom, 기본테마 } from '../../../__tests__/render-atom'
import { MAPLE_LEAF_PATH_LENGTH } from '../../Icon/maple-leaf'
import { MapleSpinner } from '../MapleSpinner'

const HIDDEN = { includeHiddenElements: true } as const

afterEach(() => {
  mockReducedMotion(false)
  withRepeatSpy.mockClear()
})

describe('MapleSpinner', () => {
  it('장식용 아이콘이라 스크린리더에서 숨겨진다', async () => {
    const { getByTestId } = await renderAtom(<MapleSpinner />)

    expect(getByTestId('maple-spinner', HIDDEN).props['aria-hidden']).toBe(true)
  })

  it('size prop으로 지정한 너비만큼 렌더링된다', async () => {
    const { getByTestId } = await renderAtom(<MapleSpinner size={40} />)

    expect(getByTestId('maple-spinner', HIDDEN).props.width).toBe(40)
  })

  it('색은 className 이 정한다. `currentColor` 가 읽는 `color` 프롭으로 들어간다', async () => {
    const { getByTestId } = await renderAtom(<MapleSpinner className="text-primary" />)

    expect(getByTestId('maple-spinner', HIDDEN).props.color).toBe(기본테마.primary)
  })

  it('className 의 크기 유틸이 size 기본값을 덮는다. 웹에서 CSS 가 속성을 이기던 순서', async () => {
    const { getByTestId } = await renderAtom(<MapleSpinner className="h-5 w-5" />)

    expect(flattenStyle(getByTestId('maple-spinner', HIDDEN).props.style)).toMatchObject({
      width: 20,
      height: 20,
    })
  })

// `pathLength={300}` + `strokeDasharray="210 90"` 과 **같은 그림**이어야 한다.
  // `react-native-svg` 에 `pathLength` 가 없어 실측 둘레에 비율을 곱하는데, 그 비율이 틀어지면
  // 트레일 길이가 조용히 달라진다(에러가 나지 않는다).
  it('트레일이 둘레의 70% 다. `pathLength` 정규화가 없는 자리를 비율이 대신한다', async () => {
    const [path] = findAllOfType((await renderAtom(<MapleSpinner />)).toJSON(), 'RNSVGPath')

    const dash = path.props.strokeDasharray as number[]
    expect(dash[0] / MAPLE_LEAF_PATH_LENGTH).toBeCloseTo(0.7, 10)
    expect(dash[0] + dash[1]).toBeCloseTo(MAPLE_LEAF_PATH_LENGTH, 10)
  })

})

describe('MapleSpinner: 모션 줄이기', () => {
  it('켜져 있으면 애니메이션을 아예 걸지 않는다. 웹의 `motion-reduce:animate-none`', async () => {
    mockReducedMotion(true)

    await renderAtom(<MapleSpinner />)

// 오프셋이 0 에 머물러 `animation: none` 이 남기던 정지 그림이 된다.
    expect(withRepeatSpy).not.toHaveBeenCalled()
  })

  it('꺼져 있으면 되감기 없이 무한 반복한다. 웹의 `infinite`(alternate 가 아니다)', async () => {
    await renderAtom(<MapleSpinner />)

// 한 주기가 둘레 한 바퀴라 되감으면 트레일이 왕복한다. 같은 방향으로 계속 돌아야 한다.
    expect(withRepeatSpy).toHaveBeenCalledTimes(1)
    expect(withRepeatSpy.mock.calls[0].slice(1)).toEqual([-1, false])
  })
})
