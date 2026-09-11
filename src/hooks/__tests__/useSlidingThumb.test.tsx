// 고른 조각 뒤를 미끄러지는 상자.
//
// **상자가 어디에 서기로 했나**는 순수 함수(`nextThumbPlacement`)에서 본다. 판정과 그리기를
// 갈라 둔 이유가 그것이다.
//
// **상자가 실제로 간 자리도 읽을 수 있다.** 리애니메이티드의 `getAnimatedStyle` 이 낸다. 단
// **가짜 타이머로 프레임을 돌려야** 한다. 안 돌리면 미끄러지는 중간값이 잡혀 마운트 시점의
// 스타일이 굳은 것처럼 보인다(이 파일이 한동안 그렇게 적혀 있었다). 아래 세 번째 describe 가
// 그 방식이고, 그것으로만 잡히는 회귀가 있다.
import { act, fireEvent } from '@testing-library/react-native'
import { useEffect, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import Animated, { getAnimatedStyle } from 'react-native-reanimated'

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

/**
 * 자리를 알리는 이벤트가 **옛 렌더의 핸들러로** 도착하는 상황.
 *
 * RN 은 레이아웃 이벤트를 그 자리가 잡힐 때 붙어 있던 핸들러로 보낸다. 고른 칸이 막 바뀐 뒤에
 * 도착한 이벤트는 아직 옛 `selectedIndex` 를 들고 있다. 화면을 떠났다 돌아오면 세그먼트가
 * 통째로 다시 재어지므로 이 순서가 실제로 난다.
 */
function ThumbHarness(props: { onFirstLayout: (fn: ItemLayout) => void }): React.JSX.Element {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const thumb = useSlidingThumb(selectedIndex)
  const 알리기 = props.onFirstLayout

  // 첫 렌더가 만든 핸들러를 붙잡아 둔다. 그것이 자리가 잡힐 때 붙어 있던 핸들러다.
  useEffect(() => {
    알리기(thumb.onItemLayout)
  }, [])

  return (
    <View>
      <AnimatedBox testID="thumb" style={thumb.style} />
      {[0, 1, 2].map((index) => (
        <Pressable
          key={index}
          testID={`item-${index}`}
          onLayout={(event) => thumb.onItemLayout(index, event)}
          onPress={() => setSelectedIndex(index)}
        >
          <Text>{index}</Text>
        </Pressable>
      ))}
    </View>
  )
}

type ItemLayout = ReturnType<typeof useSlidingThumb>['onItemLayout']

function 레이아웃이벤트(x: number, width: number): { nativeEvent: { layout: object } } {
  return { nativeEvent: { layout: { x, y: 0, width, height: 20 } } }
}

/** 상자가 실제로 가기로 한 가로 자리. 애니메이션을 끝까지 돌린 뒤에 읽는다. */
function 상자의x(view: { getByTestId: (id: string) => unknown }): unknown {
  const style = getAnimatedStyle(view.getByTestId('thumb') as never) as {
    transform?: [{ translateX: { toValue?: number } | number }]
  }
  const moved = style.transform?.[0].translateX
  return typeof moved === 'number' ? moved : moved?.toValue
}

describe('상자는 어느 칸이 알리든 지금 고른 칸으로 선다', () => {
  let 옛핸들러: ItemLayout | null = null

  // 미끄럼이 끝난 자리를 읽어야 한다. 리애니메이티드의 프레임 루프가 가짜 타이머 위에서 돈다.
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
  })

  /** 미끄럼을 끝까지 돌린다. `SLIDE_MS` 200 보다 넉넉히. */
  async function 미끄럼끝내기(): Promise<void> {
    await act(async () => {
      jest.advanceTimersByTime(400)
    })
  }

  async function 세우기(): Promise<Awaited<ReturnType<typeof renderAtom>>> {
    옛핸들러 = null
    const view = await renderAtom(
      <ThumbHarness
        onFirstLayout={(fn) => {
          옛핸들러 = fn
        }}
      />,
    )
    for (const [index, slot] of [
      { x: 0, width: 40 },
      { x: 44, width: 40 },
      { x: 88, width: 40 },
    ].entries()) {
      await act(async () => {
        fireEvent(view.getByTestId(`item-${index}`), 'layout', 레이아웃이벤트(slot.x, slot.width))
      })
    }
    return view
  }

  it('고른 칸을 누르면 그 자리로 간다', async () => {
    const view = await 세우기()

    await act(async () => {
      fireEvent.press(view.getByTestId('item-2'))
    })
    await 미끄럼끝내기()

    expect(상자의x(view)).toBe(88)
  })

  // 이것이 어긋나면 상자가 엉뚱한 칸에 남거나(옛 자리) 사라진다(못 잰 자리). 한 번 어긋나면
  // 다시 잴 계기가 없어 그대로 굳는다.
  it('옛 렌더의 핸들러로 새 자리가 도착해도 따라간다', async () => {
    const view = await 세우기()
    await act(async () => {
      fireEvent.press(view.getByTestId('item-2'))
    })
    await 미끄럼끝내기()

    // 화면을 떠났다 돌아와 세그먼트가 다시 재어졌다. 이벤트는 고른 칸이 바뀌기 전의 핸들러로 온다.
    await act(async () => {
      옛핸들러?.(2, 레이아웃이벤트(108, 40) as never)
    })

    await 미끄럼끝내기()

    expect(상자의x(view)).toBe(108)
  })

  // 옆 칸이 넓어지면 고른 칸이 밀린다. 옆 칸의 알림만으로도 상자가 제자리를 찾아야 한다.
  it('옆 칸이 자리를 알려도 다시 센다', async () => {
    const view = await 세우기()
    await act(async () => {
      fireEvent.press(view.getByTestId('item-2'))
    })
    await 미끄럼끝내기()

    await act(async () => {
      옛핸들러?.(2, 레이아웃이벤트(108, 40) as never)
      fireEvent(view.getByTestId('item-0'), 'layout', 레이아웃이벤트(0, 60))
    })

    await 미끄럼끝내기()

    expect(상자의x(view)).toBe(108)
  })
})
