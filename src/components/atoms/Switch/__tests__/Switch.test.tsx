// 스위치 아톰 가드.
//
// 이 부품이 서기 전에는 세 자리가 클래스 문자열을 각자 적었고 모양이 둘로 갈렸다. 여기서 보는
// 것은 **그 갈림이 다시 생기지 않는 조건** 셋이다. 치수가 표 하나에서 나오는가 · 색이 한 벌인가 ·
// 스크린리더 계약과 두드림을 부품이 드는가.
//
// 클래스 문자열은 트리에 안 남으므로(NativeWind 가 스타일로 푼다) 풀린 값을 본다.
import { fireEvent } from '@testing-library/react-native'

import { flattenStyle, renderAtom, 기본테마 } from '../../../__tests__/render-atom'
import { installNoopNativePorts } from '../../../../native/__tests__/fake-native-ports'
import { setHapticsPort } from '../../../../native/ports'
import { Text } from '../../Text/Text'
import { Switch } from '../Switch'

beforeEach(installNoopNativePorts)

describe('Switch: 스크린리더 계약', () => {
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

describe('Switch: 치수 두 벌', () => {
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

describe('Switch: 색 한 벌', () => {
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

describe('Switch: 누름', () => {
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

  // 누름이 아무 일도 안 하는 동안(알림 설정의 FCM 왕복)은 두드림도 없어야 한다. 울리면 손끝은
  // 바뀌었다고 말하고 값은 그대로다.
  it('disabled 면 onToggle 도 두드림도 없다', async () => {
    const select = jest.fn().mockResolvedValue(undefined)
    setHapticsPort({ tap: jest.fn().mockResolvedValue(undefined), select })
    const onToggle = jest.fn()
    const { getByLabelText } = await renderAtom(
      <Switch on={false} label="켜기" disabled onToggle={onToggle} />,
    )

    fireEvent.press(getByLabelText('켜기'))

    expect(onToggle).not.toHaveBeenCalled()
    expect(select).not.toHaveBeenCalled()
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
