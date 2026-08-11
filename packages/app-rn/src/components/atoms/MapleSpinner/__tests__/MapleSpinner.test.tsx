// 웹판이 지키던 셋 중 둘(장식용 숨김 · `size` 반영)은 그대로고, 셋째("motion-reduce 클래스가 있다")는
// **여기서 지킬 것이 없다** — 아직 모션 자체가 없다(step 7). 대신 그 자리를 웹에 없던 계약이 채운다:
// `pathLength` 정규화가 사라진 만큼 **대시가 실측 둘레의 70/30 이어야 한다**(컴포넌트 주석 참고).
//
// 쿼리에 `includeHiddenElements` 를 주는 것 자체가 `aria-hidden` 이 먹었다는 증거다 — RNTL 은 숨긴
// 요소를 기본적으로 못 찾는다(플래그를 빼면 첫 케이스가 "찾을 수 없다"로 떨어진다, 실측).
import { findAllOfType, flattenStyle, renderAtom, 기본테마 } from '../../../__tests__/render-atom'
import { MAPLE_LEAF_PATH_LENGTH } from '../../../mapleLeafPath'
import { MapleSpinner } from '../MapleSpinner'

const HIDDEN = { includeHiddenElements: true } as const

describe('MapleSpinner', () => {
  it('장식용 아이콘이라 스크린리더에서 숨겨진다', async () => {
    const { getByTestId } = await renderAtom(<MapleSpinner />)

    expect(getByTestId('maple-spinner', HIDDEN).props['aria-hidden']).toBe(true)
  })

  it('size prop으로 지정한 너비만큼 렌더링된다', async () => {
    const { getByTestId } = await renderAtom(<MapleSpinner size={40} />)

    expect(getByTestId('maple-spinner', HIDDEN).props.width).toBe(40)
  })

  it('색은 className 이 정한다 — `currentColor` 가 읽는 `color` 프롭으로 들어간다', async () => {
    const { getByTestId } = await renderAtom(<MapleSpinner className="text-primary" />)

    expect(getByTestId('maple-spinner', HIDDEN).props.color).toBe(기본테마.primary)
  })

  it('className 의 크기 유틸이 size 기본값을 덮는다 — 웹에서 CSS 가 속성을 이기던 순서', async () => {
    const { getByTestId } = await renderAtom(<MapleSpinner className="h-5 w-5" />)

    expect(flattenStyle(getByTestId('maple-spinner', HIDDEN).props.style)).toMatchObject({
      width: 20,
      height: 20,
    })
  })

  // 웹의 `pathLength={300}` + `strokeDasharray="210 90"` 과 **같은 그림**이어야 한다.
  // `react-native-svg` 에 `pathLength` 가 없어 실측 둘레에 비율을 곱하는데, 그 비율이 틀어지면
  // 트레일 길이가 조용히 달라진다(에러가 나지 않는다).
  it('트레일이 둘레의 70% 다 — `pathLength` 정규화가 없는 자리를 비율이 대신한다', async () => {
    const [path] = findAllOfType((await renderAtom(<MapleSpinner />)).toJSON(), 'RNSVGPath')

    const dash = path.props.strokeDasharray as number[]
    expect(dash[0] / MAPLE_LEAF_PATH_LENGTH).toBeCloseTo(0.7, 10)
    expect(dash[0] + dash[1]).toBeCloseTo(MAPLE_LEAF_PATH_LENGTH, 10)
  })

  it('렌더 트리 스냅샷 — 이후 변경을 잡는 기준선(예전 화면과의 대조가 아니다)', async () => {
    expect((await renderAtom(<MapleSpinner className="text-primary" />)).toJSON()).toMatchSnapshot()
  })
})
