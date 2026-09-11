/**
 * 페이지 헤더의 `←`.
 *
 * 부품으로 뽑은 이유가 **두드림**이다. 뒤로 버튼은 새 페이지가 생길 때마다 늘어나므로
 * 호출부마다 `tapFeedback()` 을 적어 두면 다음 페이지가 빠뜨리고, 그 페이지에서만 손끝이
 * 조용한 것을 아무도 못 본다.
 */
import { fireEvent } from '@testing-library/react-native'

import { flattenStyle, renderAtom } from '../../../__tests__/render-atom'
import { __resetNativePortsForTest, setHapticsPort } from '../../../../native/ports'
import { BackButton } from '../BackButton'

describe('BackButton', () => {
  const tap = jest.fn(async () => undefined)

  beforeEach(() => {
    tap.mockClear()
    setHapticsPort({ tap, select: async () => {} })
  })

  afterEach(__resetNativePortsForTest)

  it('누르면 두드리고 `onPress` 를 부른다', async () => {
    const onPress = jest.fn()
    const { getByLabelText } = await renderAtom(<BackButton onPress={onPress} />)

    fireEvent.press(getByLabelText('뒤로'))

    expect(tap).toHaveBeenCalledTimes(1)
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('스크린리더에 뒤로 버튼으로 들린다', async () => {
    const { getByRole } = await renderAtom(<BackButton onPress={jest.fn()} />)

    expect(getByRole('button', { name: '뒤로' })).toBeTruthy()
  })

  // 옮겨오기 전 열다섯 자리가 두 가지 그림이었다. 이번 작업이 바꾸는 것은 촉감이라 둘 다 남긴다.
  it('기본은 설정 하위 화면들이 쓰던 작은 칸이다', async () => {
    const { getByLabelText } = await renderAtom(<BackButton onPress={jest.fn()} />)

    const style = flattenStyle(getByLabelText('뒤로').props.style)
    expect(style.padding).toBe(4)
    expect(style.marginLeft).toBe(-4)
  })

  it('`regular` 은 손가락이 닿는 칸이 36px 이다', async () => {
    const { getByLabelText } = await renderAtom(<BackButton size="regular" onPress={jest.fn()} />)

    const style = flattenStyle(getByLabelText('뒤로').props.style)
    expect(style.width).toBe(36)
    expect(style.height).toBe(36)
    expect(style.marginLeft).toBe(-8)
  })
})
