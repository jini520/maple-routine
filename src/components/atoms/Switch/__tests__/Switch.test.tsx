// 스위치 아톰 가드.
//
// 이 부품이 서기 전에는 세 자리가 클래스 문자열을 각자 적었고 모양이 둘로 갈렸다. 여기서 보는
// 것은 **그 갈림이 다시 생기지 않는 조건** 셋이다. 치수가 표 하나에서 나오는가 · 색이 한 벌인가 ·
// 스크린리더 계약과 두드림을 부품이 드는가.
//
// iOS 는 RN 기본 `Switch` 를 줄여 그리고 안드로이드는 트랙 · 손잡이를 그린다. 그림은 갈려도
// 스크린리더 계약과 누름은 두 플랫폼이 같아야 한다.
//
// 클래스 문자열은 트리에 안 남으므로(NativeWind 가 스타일로 푼다) 풀린 값을 본다.
import { fireEvent } from '@testing-library/react-native'
import { Platform } from 'react-native'
import { useReducedMotion } from 'react-native-reanimated'

import { flattenStyle, renderAtom, 기본테마 } from '../../../__tests__/render-atom'
import { installNoopNativePorts } from '../../../../native/__tests__/fake-native-ports'
import { setHapticsPort } from '../../../../native/ports'
import { Text } from '../../Text/Text'
import { Switch } from '../Switch'

// 움직임 줄이기만 바꿔 끼운다. `__esModule` 은 펼쳐도 안 넘어와서(열거되지 않는 키) 직접 적는다.
// 빠지면 `import Animated from` 이 모듈 전체를 받아 `Animated.View` 가 없어진다.
jest.mock('react-native-reanimated', () => ({
  ...jest.requireActual('react-native-reanimated'),
  __esModule: true,
  useReducedMotion: jest.fn(() => false),
}))

const 원래플랫폼 = Platform.OS

beforeEach(() => {
  installNoopNativePorts()
  // 아래 치수 · 색 · 손잡이 묶음은 안드로이드 갈래다. iOS 를 보는 묶음은 자기가 바꾼다.
  Platform.OS = 'android'
})

afterEach(() => {
  Platform.OS = 원래플랫폼
})

describe.each(['ios', 'android'] as const)('Switch(%s): 스크린리더 계약', (os) => {
  beforeEach(() => {
    Platform.OS = os
  })

  it('role·aria-checked·aria-label 을 부품이 낸다', async () => {
    const { getByLabelText } = await renderAtom(
      <Switch on label="알림 받기" onToggle={() => {}} />,
    )

    const target = getByLabelText('알림 받기')
    expect(target.props.role).toBe('switch')
    expect(target.props.accessibilityState.checked).toBe(true)
  })

  it('꺼져 있으면 checked 가 거짓이다', async () => {
    const { getByLabelText } = await renderAtom(
      <Switch on={false} label="알림 받기" onToggle={() => {}} />,
    )

    expect(getByLabelText('알림 받기').props.accessibilityState.checked).toBe(false)
  })
})

describe('Switch(android): 치수 두 벌', () => {
  it('sm 은 트랙 28×16 · 손잡이 12 다. 안 적으면 이것이다', async () => {
    const { getByTestId } = await renderAtom(
      <Switch on={false} label="드롭 연출" onToggle={() => {}} />,
    )

    expect(flattenStyle(getByTestId('switch-track').props.style)).toMatchObject({
      width: 28,
      height: 16,
      borderRadius: 9999,
    })
    expect(flattenStyle(getByTestId('switch-knob').props.style)).toMatchObject({
      width: 12,
      height: 12,
    })
  })

  it('lg 는 트랙 44×24 · 손잡이 20 이다', async () => {
    const { getByTestId } = await renderAtom(
      <Switch on={false} label="모든 보스 보기" size="lg" onToggle={() => {}} />,
    )

    expect(flattenStyle(getByTestId('switch-track').props.style)).toMatchObject({
      width: 44,
      height: 24,
    })
    expect(flattenStyle(getByTestId('switch-knob').props.style)).toMatchObject({
      width: 20,
      height: 20,
    })
  })

  // 손잡이가 가는 거리는 `트랙 폭 − 손잡이 − 2` 다. 세 수가 어긋나면 손잡이가 트랙을 넘거나
  // 덜 간다. 두 크기 모두 오른쪽 끝에 2 가 남아야 한다.
  it.each([
    { size: undefined, track: 28, knob: 12, on: 14 },
    { size: 'lg' as const, track: 44, knob: 20, on: 22 },
  ])('$size 손잡이는 2 에서 $on 으로 간다', async ({ size, track, knob, on }) => {
    const 꺼짐 = await renderAtom(<Switch on={false} label="켜기" size={size} onToggle={() => {}} />)
    expect(flattenStyle(꺼짐.getByTestId('switch-knob').props.style).transform).toEqual([
      { translateX: 2 },
    ])

    const 켜짐 = await renderAtom(<Switch on label="켜기" size={size} onToggle={() => {}} />)
    expect(flattenStyle(켜짐.getByTestId('switch-knob').props.style).transform).toEqual([
      { translateX: on },
    ])
    expect(on).toBe(track - knob - 2)
  })
})

describe('Switch(android): 색 한 벌', () => {
  it('켜면 트랙이 primary 다', async () => {
    const { getByTestId } = await renderAtom(<Switch on label="켜기" onToggle={() => {}} />)

    expect(flattenStyle(getByTestId('switch-track').props.style).backgroundColor).toBe(
      기본테마.primary,
    )
  })

  it('끄면 트랙이 surface-2 이고 손잡이는 언제나 surface 다', async () => {
    const { getByTestId } = await renderAtom(
      <Switch on={false} label="켜기" onToggle={() => {}} />,
    )

    expect(flattenStyle(getByTestId('switch-track').props.style).backgroundColor).toBe(
      기본테마.surface2,
    )
    expect(flattenStyle(getByTestId('switch-knob').props.style).backgroundColor).toBe(
      기본테마.surface,
    )
  })
})

// 손잡이만 흐르고 트랙 색은 누르는 즉시 바뀐다. Reanimated 는 트랜지션 키를 `style` 에서 걷어
// 가므로, 전달됐는지는 `jestInlineStyle`(테스트용으로 남기는 원본)로 본다.
describe('Switch(android): 손잡이가 미끄러진다', () => {
  const 움직임줄이기 = jest.mocked(useReducedMotion)

  beforeEach(() => {
    움직임줄이기.mockReturnValue(false)
  })

  it('손잡이에 transform 트랜지션이 붙는다', async () => {
    const { getByTestId } = await renderAtom(<Switch on label="켜기" onToggle={() => {}} />)

    expect(getByTestId('switch-knob').props.jestInlineStyle).toMatchObject({
      transitionProperty: 'transform',
      transitionDuration: '200ms',
    })
  })

  it('움직임 줄이기를 켜면 트랜지션 키가 아예 없다. 곧바로 선다', async () => {
    움직임줄이기.mockReturnValue(true)
    const { getByTestId } = await renderAtom(<Switch on label="켜기" onToggle={() => {}} />)

    expect(getByTestId('switch-knob').props.jestInlineStyle).not.toHaveProperty(
      'transitionProperty',
    )
  })

  // 색까지 흐르면 그동안 누른 스위치가 안 눌린 것처럼 보인다.
  it('트랙 색은 안 흐른다', async () => {
    const { getByTestId } = await renderAtom(<Switch on label="켜기" onToggle={() => {}} />)

    expect(getByTestId('switch-track').props.jestInlineStyle?.transitionProperty).toBeUndefined()
  })
})

describe.each(['ios', 'android'] as const)('Switch(%s): 누름', (os) => {
  beforeEach(() => {
    Platform.OS = os
  })

  it('누르면 onToggle 과 선택 촉각을 부품이 낸다', async () => {
    const select = jest.fn().mockResolvedValue(undefined)
    setHapticsPort({ tap: jest.fn().mockResolvedValue(undefined), select })
    const onToggle = jest.fn()
    const { getByLabelText } = await renderAtom(
      <Switch on={false} label="켜기" onToggle={onToggle} />,
    )

    fireEvent.press(getByLabelText('켜기'))

    expect(onToggle).toHaveBeenCalledTimes(1)
    expect(select).toHaveBeenCalledTimes(1)
  })

  // 글자가 누름 과녁 안이라 글자를 눌러도 토글된다. 스위치만 과녁이면 표적이 44×24 하나뿐이다.
  it('children 으로 넣은 글자를 눌러도 토글된다', async () => {
    const onToggle = jest.fn()
    const { getByText } = await renderAtom(
      <Switch on={false} label="모든 보스 보기" size="lg" onToggle={onToggle}>
        <Text className="text-xs font-medium text-text-muted">모든 보스 보기</Text>
      </Switch>,
    )

    fireEvent.press(getByText('모든 보스 보기'))

    expect(onToggle).toHaveBeenCalledTimes(1)
  })
})

describe('Switch(ios): 줄인 시스템 스위치', () => {
  beforeEach(() => {
    Platform.OS = 'ios'
  })

  // 높이를 안드로이드 갈래와 같게 줄여 줄 높이가 안 바뀐다. 시스템 스위치는 63×28 고정이라
  // 배율로만 준다. 줄이기가 가운데 기준이라 이 자리여야 보이는 그림이 박스에 딱 맞는다.
  it.each([
    { size: undefined, box: { width: 36, height: 16 }, scale: 16 / 28, left: -13.5, top: -6 },
    { size: 'lg' as const, box: { width: 54, height: 24 }, scale: 24 / 28, left: -4.5, top: -2 },
  ])('$size 는 $box.width×$box.height 박스에 줄여 넣는다', async ({ size, box, scale, left, top }) => {
    const { getByTestId, queryByTestId } = await renderAtom(
      <Switch on={false} label="켜기" size={size} onToggle={() => {}} />,
    )

    expect(flattenStyle(getByTestId('switch-box').props.style)).toMatchObject(box)
    expect(flattenStyle(getByTestId('switch-native').props.style)).toMatchObject({
      position: 'absolute',
      left,
      top,
      transform: [{ scale }],
    })
    expect(queryByTestId('switch-knob')).toBeNull()
  })

  it('on 이 시스템 스위치의 값이다', async () => {
    const 켜짐 = await renderAtom(<Switch on label="켜기" onToggle={() => {}} />)
    expect(켜짐.getByTestId('switch-native').props.value).toBe(true)

    const 꺼짐 = await renderAtom(<Switch on={false} label="켜기" onToggle={() => {}} />)
    expect(꺼짐.getByTestId('switch-native').props.value).toBe(false)
  })

  // iOS 26 의 누름 효과 · 끌기를 살리려고 시스템 스위치가 누름을 직접 받는다.
  it('시스템 스위치를 누르면 onToggle 과 선택 촉각이 한 번씩 난다', async () => {
    const select = jest.fn().mockResolvedValue(undefined)
    setHapticsPort({ tap: jest.fn().mockResolvedValue(undefined), select })
    const onToggle = jest.fn()
    const { getByTestId } = await renderAtom(
      <Switch on={false} label="켜기" onToggle={onToggle} />,
    )

    expect(getByTestId('switch-box').props.pointerEvents).toBeUndefined()
    fireEvent(getByTestId('switch-native'), 'valueChange', true)

    expect(onToggle).toHaveBeenCalledTimes(1)
    expect(select).toHaveBeenCalledTimes(1)
  })

  it('켜짐 primary · 꺼짐 surface-2 를 준다. 손잡이는 시스템 색이다', async () => {
    const { getByTestId } = await renderAtom(<Switch on label="켜기" onToggle={() => {}} />)
    const native = getByTestId('switch-native')

    expect(native.props.onTintColor).toBe(기본테마.primary)
    expect(native.props.tintColor).toBe(기본테마.surface2)
    expect(flattenStyle(native.props.style).backgroundColor).toBe(기본테마.surface2)
    expect(native.props.thumbTintColor).toBeUndefined()
  })
})
