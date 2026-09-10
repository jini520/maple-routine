// 고른 조각 뒤를 미끄러지는 상자.
//
// **판정과 그리기를 갈라 둔 이유가 여기 있다.** 리애니메이티드가 낸 스타일은 jest 에서
// 마운트 시점의 한 벌로 굳는다. 갱신이 리액트 프롭이 아니라 UI 스레드로 가기 때문이고, 그
// 스레드가 테스트에는 없다. 그래서 **상자가 어디에 서기로 했나**는 순수 함수에서 보고, 렌더된
// 스타일에서는 **마운트 순간의 한 가지**만 본다.
import { View } from 'react-native'
import Animated from 'react-native-reanimated'

import { flattenStyle, renderAtom } from '../../components/__tests__/render-atom'
import { nextThumbPlacement, useSlidingThumb, type ThumbPlacement } from '../useSlidingThumb'

describe('상자가 설 자리', () => {
  const 자리 = { x: 40, width: 60 }
  const 서있음: ThumbPlacement = { slot: { x: 0, width: 40 }, slides: false }

  // 재기 전에 0 폭으로 그리면 왼쪽 끝에 실선 하나가 번쩍인다.
  it('못 잰 자리에는 안 선다', () => {
    expect(nextThumbPlacement(null, undefined)).toBeNull()
  })

  it('고른 것이 없어지면 자리를 뜬다', () => {
    expect(nextThumbPlacement(서있음, undefined)).toBeNull()
  })

  it('잰 자리를 그대로 받는다', () => {
    expect(nextThumbPlacement(null, 자리)?.slot).toEqual(자리)
  })

  // 미끄러짐은 여기서 저기로 갔다는 말이다. 열자마자 왼쪽 끝에서 달려오면 사용자가 안 누른
  // 이동을 보게 된다.
  it('처음 서는 자리에서는 안 미끄러진다', () => {
    expect(nextThumbPlacement(null, 자리)?.slides).toBe(false)
  })

  it('서 있다가 옮겨 갈 때만 미끄러진다', () => {
    expect(nextThumbPlacement(서있음, 자리)?.slides).toBe(true)
  })

  // 고른 것이 없다가 생기는 자리(지출 시트의 `단계` 줄)도 처음 서는 자리다. 뜬 자리에서
  // 달려오면 안 된다.
  it('자리를 떴다가 다시 서면 또 처음이다', () => {
    const 떴다 = nextThumbPlacement(서있음, undefined)

    expect(nextThumbPlacement(떴다, 자리)?.slides).toBe(false)
  })

  // 새 객체를 내면 스타일이 다시 계산돼 제자리에서 한 번 더 움직인다. 조각이 자기 자리를
  // 다시 알리는 일은 화면이 다시 그려질 때마다 생긴다.
  it('같은 자리를 다시 받으면 들고 있던 것을 그대로 낸다', () => {
    const 서있던 = nextThumbPlacement(null, 자리)

    expect(nextThumbPlacement(서있던, { ...자리 })).toBe(서있던)
  })

  it('폭만 달라져도 옮겨 간 것이다', () => {
    const 서있던 = nextThumbPlacement(null, 자리)

    expect(nextThumbPlacement(서있던, { x: 40, width: 52 })?.slot.width).toBe(52)
  })
})

const AnimatedBox = Animated.createAnimatedComponent(View)

function Harness(props: { selectedIndex: number }): React.JSX.Element {
  const thumb = useSlidingThumb(props.selectedIndex)

  return <AnimatedBox testID="thumb" style={thumb.style} />
}

describe('훅이 스타일에 잇는다', () => {
  it('아직 아무것도 안 쟀으면 상자가 안 보인다', async () => {
    const view = await renderAtom(<Harness selectedIndex={0} />)

    expect(flattenStyle(view.getByTestId('thumb').props.style).opacity).toBe(0)
  })

  it('고른 것이 없으면 상자가 안 보인다', async () => {
    const view = await renderAtom(<Harness selectedIndex={-1} />)

    expect(flattenStyle(view.getByTestId('thumb').props.style).opacity).toBe(0)
  })
})
