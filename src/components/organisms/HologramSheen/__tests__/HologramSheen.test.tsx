// 효과 층은 카드를 재지 않는다. 가는 띠 둘을 GPU 변환으로 늘려 고정 크기 상자로 카드를 덮는다. 레이아웃을 잰 뒤 다시 그리면
// iOS 그라디언트가 비트맵을 다시 그려 흰 바탕이 한 프레임 비친다. 그래서 계약은 셋이다. ① 레이아웃 전에 띠가 선다
// ② 경로 끝에서도 `HOLO_COVER` 크기의 카드를 덮는다 ③ 비트맵이 가늘다.
import { getAnimatedStyle, useSharedValue } from 'react-native-reanimated'

import { renderAtom } from '../../../__tests__/render-atom'
import { HOLO_COVER, HologramSheen } from '../HologramSheen'
import { HOLO_REACH } from '../holo-motion'

interface Strip {
  width: number
  height: number
  transform: Record<string, number | string>[]
}

function Probe(props: { x: number; y: number }): React.JSX.Element {
  const x = useSharedValue(props.x)
  const y = useSharedValue(props.y)
  return <HologramSheen variant="card" motion={{ x, y }} />
}

/** 변환 목록에서 이름의 값. 없으면 `fallback`(scale 은 1, 이동은 0). */
function part(strip: Strip, name: string, fallback: number): number {
  const found = strip.transform.find((entry) => name in entry)
  return found === undefined ? fallback : Number(found[name])
}

async function 띠들(x: number, y: number): Promise<{ metal: Strip; aurora: Strip }> {
  const view = await renderAtom(<Probe x={x} y={y} />)
  const read = (id: string): Strip => getAnimatedStyle(view.getByTestId(id) as never) as unknown as Strip
  return { metal: read('hologram-metal'), aurora: read('hologram-aurora') }
}

it('레이아웃을 재기 전에도 두 띠가 선다', async () => {
  const view = await renderAtom(<Probe x={0} y={0} />)

  expect(view.getByTestId('hologram-metal')).toBeTruthy()
  expect(view.getByTestId('hologram-aurora')).toBeTruthy()
})

it('띠 비트맵은 가늘다', async () => {
  const { metal, aurora } = await 띠들(0, 0)

  expect(Math.min(metal.width, metal.height)).toBeLessThanOrEqual(8)
  expect(Math.min(aurora.width, aurora.height)).toBeLessThanOrEqual(8)
})

describe.each([
  [HOLO_REACH, HOLO_REACH],
  [-HOLO_REACH, -HOLO_REACH],
  [HOLO_REACH, -HOLO_REACH],
  [-HOLO_REACH, HOLO_REACH],
])('경로 끝 (%s, %s)', (x, y) => {
  it('늘린 띠가 가장 큰 카드를 다 덮는다', async () => {
    const { metal, aurora } = await 띠들(x, y)
    // 카드는 가로 · 세로 모두 HOLO_COVER 까지다. 가운데 기준 반대각선이 가장 먼 모서리다.
    const halfDiagonal = (HOLO_COVER * Math.SQRT2) / 2

    // 오로라 띠는 가로로 늘리고 세로는 카드 위에서 시작한다.
    const auroraHalfWidth = (aurora.width * part(aurora, 'scaleX', 1)) / 2
    expect(auroraHalfWidth - Math.abs(part(aurora, 'translateX', 0))).toBeGreaterThanOrEqual(HOLO_COVER / 2)
    expect(aurora.height - Math.abs(part(aurora, 'translateY', 0))).toBeGreaterThanOrEqual(HOLO_COVER)

    // 금속 띠는 돌아가 있어 길이 · 두께 모두 반대각선과 이동 거리를 넘어야 한다.
    const travel = Math.hypot(part(metal, 'translateX', 0), part(metal, 'translateY', 0))
    expect(metal.width / 2 - travel).toBeGreaterThanOrEqual(halfDiagonal)
    expect((metal.height * part(metal, 'scaleY', 1)) / 2 - travel).toBeGreaterThanOrEqual(halfDiagonal)
  })
})
