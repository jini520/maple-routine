// 효과 층은 카드보다 사방으로 여유 폭만큼 큰 띠 상자 둘이 미끄러지는 것이다. 띠가 경로 끝에서 여유 폭보다 멀리 가면
// 카드 가장자리에 상자의 끝이 보인다. 여유 폭을 이동 거리에서 계산하므로 거리나 경로 끝을 바꿔도 이 계약은 지켜져야 한다.
//
// 카드 크기는 안 본다. 테스트의 애니메이션 스타일은 첫 계산값에 머물러 레이아웃 뒤의 크기를 안 담는다. 여유 폭은 상자의
// `left` · `top` 으로 읽히고, 계약은 크기와 무관하게 이동 거리와 여유 폭의 비교다.
import { act } from '@testing-library/react-native'
import { getAnimatedStyle, useSharedValue } from 'react-native-reanimated'

import { renderAtom } from '../../../__tests__/render-atom'
import { HologramSheen } from '../HologramSheen'
import { HOLO_REACH } from '../holo-motion'

const CARD = { width: 300, height: 120 }

interface Box {
  left: number
  top: number
  transform: [{ translateX: number }, { translateY: number }]
}

function Probe(props: { x: number; y: number }): React.JSX.Element {
  const x = useSharedValue(props.x)
  const y = useSharedValue(props.y)
  return <HologramSheen variant="card" motion={{ x, y }} />
}

async function 띠상자들(x: number, y: number): Promise<Box[]> {
  const view = await renderAtom(<Probe x={x} y={y} />)
  // 효과 층은 `pointerEvents="none"` 이라 `fireEvent` 가 이벤트를 막는다. 레이아웃 핸들러를 직접 부른다.
  const sheen = view.getByTestId('hologram-sheen')
  await act(async () => sheen.props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, ...CARD } } }))
  return ['hologram-metal', 'hologram-aurora'].map((id) => getAnimatedStyle(view.getByTestId(id) as never) as Box)
}

describe.each([
  [HOLO_REACH, HOLO_REACH],
  [-HOLO_REACH, -HOLO_REACH],
  [HOLO_REACH, -HOLO_REACH],
  [-HOLO_REACH, HOLO_REACH],
])('경로 끝 (%s, %s)', (x, y) => {
  it('두 띠가 여유 폭 안에서 움직인다', async () => {
    for (const box of await 띠상자들(x, y)) {
      expect(Math.abs(box.transform[0].translateX)).toBeLessThanOrEqual(-box.left)
      expect(Math.abs(box.transform[1].translateY)).toBeLessThanOrEqual(-box.top)
    }
  })
})

// 카드는 기간을 넘길 때 다시 마운트된다. 레이아웃을 잰 뒤에야 띠를 그리면 흰 카드가 한 프레임 먼저 서고
// 오로라가 늦게 덮인다. 띠는 카드와 같은 프레임에 서야 한다.
it('레이아웃을 재기 전에도 두 띠가 선다', async () => {
  const view = await renderAtom(<Probe x={0} y={0} />)

  expect(view.getByTestId('hologram-metal')).toBeTruthy()
  expect(view.getByTestId('hologram-aurora')).toBeTruthy()
})
